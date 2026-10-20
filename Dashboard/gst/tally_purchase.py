"""Read-only purchase extraction. Uses explicit ledger mappings, never guessed tax splits."""
import calendar, re
from decimal import Decimal, InvalidOperation
import xml.etree.ElementTree as ET

def request_xml(company, period):
    if not company or not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',period):raise ValueError('Exact company and YYYY-MM period required')
    year,month=map(int,period.split('-')); last=calendar.monthrange(year,month)[1]
    root=ET.Element('ENVELOPE');h=ET.SubElement(root,'HEADER')
    for k,v in [('VERSION','1'),('TALLYREQUEST','Export'),('TYPE','Collection'),('ID','BNXPurchaseRead')]:ET.SubElement(h,k).text=v
    desc=ET.SubElement(ET.SubElement(root,'BODY'),'DESC');sv=ET.SubElement(desc,'STATICVARIABLES')
    for k,v in [('SVCURRENTCOMPANY',company),('SVFROMDATE',f'{year}{month:02d}01'),('SVTODATE',f'{year}{month:02d}{last:02d}'),('SVEXPORTFORMAT','$$SysName:XML')]:ET.SubElement(sv,k).text=v
    msg=ET.SubElement(ET.SubElement(desc,'TDL'),'TDLMESSAGE');col=ET.SubElement(msg,'COLLECTION',NAME='BNXPurchaseRead',ISMODIFY='No')
    ET.SubElement(col,'TYPE').text='Voucher';ET.SubElement(col,'FETCH').text='*,ALLLEDGERENTRIES.*,LEDGERENTRIES.*,ALLINVENTORYENTRIES.*'
    ET.SubElement(col,'FILTER').text='BNXPurchaseFilter'
    ET.SubElement(msg,'SYSTEM',TYPE='Formulae',NAME='BNXPurchaseFilter').text='$$IsPurchase:$VoucherTypeName AND NOT $IsCancelled AND NOT $IsOptional'
    return ET.tostring(root,encoding='utf-8')

def parse_purchases(text, company, period, mapping):
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():raise ValueError('XML entities not accepted')
    root=ET.fromstring(text)
    if root.find('.//COLLECTION') is None:raise ValueError('No purchase collection returned; check Tally company and server configuration')
    errors=root.findall('.//LINEERROR')
    if errors:raise ValueError('; '.join(e.text or '' for e in errors))
    if root.tag.upper() not in ('ENVELOPE','DATA','RESPONSE'):raise ValueError('Unexpected Tally response')
    groups={k:[str(x).strip() for x in mapping.get(k,[]) if str(x).strip()] for k in ('base','cgst','sgst','igst','cess','roundOff')}
    if not groups['base']:raise ValueError('At least one purchase taxable ledger required')
    names={}
    for role,ledgers in groups.items():
        for name in ledgers:
            key=name.casefold()
            if key in names:raise ValueError('Ledger mapped more than once: '+name)
            names[key]=role
    rows=[];issues=[];seen=set()
    for v in root.findall('.//VOUCHER'):
        ref=v.findtext('REFERENCE') or v.findtext('VOUCHERNUMBER') or ''
        try:
            if (v.findtext('ISCANCELLED','No').lower()=='yes' or v.findtext('ISOPTIONAL','No').lower()=='yes'):continue
            raw=v.findtext('DATE','');date=raw[:4]+'-'+raw[4:6]+'-'+raw[6:8] if re.fullmatch(r'\d{8}',raw) else raw
            if not date.startswith(period+'-'):raise ValueError('Voucher date outside requested month')
            party=v.findtext('PARTYLEDGERNAME','').strip();gstin=v.findtext('PARTYGSTIN','').strip().upper()
            if not ref or not party:raise ValueError('Supplier invoice reference/party missing')
            if not re.fullmatch(r'\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]',gstin):raise ValueError('Supplier GSTIN missing or invalid format')
            key=(gstin,ref,date)
            if key in seen:raise ValueError('Duplicate supplier invoice reference')
            seen.add(key);parts={k:Decimal(0) for k in groups};total=None
            entries=list(v.findall('ALLLEDGERENTRIES.LIST'))+list(v.findall('LEDGERENTRIES.LIST'))
            if not entries:raise ValueError('Ledger entries missing')
            for e in entries:
                name=e.findtext('LEDGERNAME','').strip();rawamount=e.findtext('AMOUNT','').strip()
                try:amount=Decimal(rawamount)
                except InvalidOperation:raise ValueError('Non-numeric amount for '+name)
                if not amount.is_finite():raise ValueError('Non-finite ledger amount')
                if name==party:
                    if total is not None:raise ValueError('Multiple supplier lines need review')
                    total=amount;continue
                role=names.get(name.casefold())
                if not role and amount:raise ValueError('Unmapped ledger: '+name)
                if role:parts[role]-=amount
            # Item-invoice purchases carry base allocations inside inventory entries.
            for inv in v.findall('ALLINVENTORYENTRIES.LIST'):
                for e in inv.findall('ACCOUNTINGALLOCATIONS.LIST'):
                    name=e.findtext('LEDGERNAME','').strip()
                    if names.get(name.casefold())!='base':raise ValueError('Unmapped inventory purchase ledger: '+name)
                    a=Decimal(e.findtext('AMOUNT','NaN'))
                    if not a.is_finite():raise ValueError('Invalid inventory allocation')
                    parts['base']-=a
            if total is None or total<=0:raise ValueError('Positive supplier credit total required')
            if any(parts[k]<0 for k in ('base','cgst','sgst','igst','cess')):raise ValueError('Reversal/credit note requires review')
            if parts['igst'] and (parts['cgst'] or parts['sgst']):raise ValueError('Mixed IGST and local GST')
            if abs(sum(parts.values())-total)>Decimal('0.01'):raise ValueError('Ledger components do not balance to supplier total')
            pos=v.findtext('PLACEOFSUPPLY','').strip()
            # Do not infer place of supply from supplier GSTIN.
            reference_date=v.findtext('REFERENCEDATE','').strip()
            invoice_date=reference_date[:4]+'-'+reference_date[4:6]+'-'+reference_date[6:8] if re.fullmatch(r'\d{8}',reference_date) else date
            row={'invoiceNo':ref,'date':invoice_date,'voucherDate':date,'dateBasis':'supplier reference date' if reference_date else 'voucher date; verify supplier invoice date','gstin':gstin,'name':party,'pos':pos,'total':float(total),'roundOff':float(parts['roundOff']),
                'items':[{'taxable':float(parts['base']),'cgst':float(parts['cgst']),'sgst':float(parts['sgst']),'igst':float(parts['igst']),'cess':float(parts['cess'])}],
                'source':'TALLY_PURCHASE','sourceCompany':company,'voucherNo':v.findtext('VOUCHERNUMBER',''),'referenceDate':v.findtext('REFERENCEDATE','')}
            rows.append(row)
        except (ValueError,InvalidOperation) as e:issues.append({'invoice':ref,'error':str(e)})
    return {'rows':rows,'issues':issues,'complete':not issues,'company':company,'period':period,'readOnly':True}
