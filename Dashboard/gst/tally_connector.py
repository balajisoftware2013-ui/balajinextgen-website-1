"""Balaji NextGen local Tally relay. Python 3 standard library only."""
import hashlib, json, sqlite3, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import xml.etree.ElementTree as ET

ALLOWED = {'https://www.balajinextgen.in', 'https://balajinextgen.in'}
DB = Path(__file__).resolve().with_name('tally_posting_journal.sqlite3')
TALLY = 'http://127.0.0.1:9000'

def journal():
    c=sqlite3.connect(DB)
    c.execute('CREATE TABLE IF NOT EXISTS posting (key TEXT PRIMARY KEY, state TEXT NOT NULL, response TEXT)')
    return c

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def reply(self,code,body):
        self.send_response(code)
        origin=self.headers.get('Origin','')
        if origin in ALLOWED:self.send_header('Access-Control-Allow-Origin',origin)
        self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
        self.send_header('Access-Control-Allow-Private-Network','true')
        self.send_header('Content-Type','text/plain; charset=utf-8')
        self.end_headers();self.wfile.write(body.encode('utf-8'))
    def do_OPTIONS(self):
        self.reply(204 if self.headers.get('Origin') in ALLOWED else 403,'')
    def do_POST(self):
        if self.headers.get('Origin') not in ALLOWED:return self.reply(403,'Origin not allowed')
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=8*1024*1024:raise ValueError('Invalid request size')
            data=self.rfile.read(size)
            if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():raise ValueError('XML entities are not accepted')
            root=ET.fromstring(data)
            vouchers=root.findall('.//VOUCHER')
            company=root.findtext('.//SVCURRENTCOMPANY','').strip()
            key=None
            if vouchers:
                if len(vouchers)!=1 or not company:raise ValueError('Post one voucher with an exact company name')
                remote=vouchers[0].get('REMOTEID','')
                if not remote.startswith('BNX-'):raise ValueError('Missing ERP voucher identity')
                key=hashlib.sha256((company+'|'+remote).encode()).hexdigest()
                with journal() as c:
                    previous=c.execute('SELECT state,response FROM posting WHERE key=?',(key,)).fetchone()
                    if previous: return self.reply(409,'Voucher already attempted ('+previous[0]+'). Check Tally Day Book; no resend performed.')
                    c.execute('INSERT INTO posting VALUES (?,?,?)',(key,'pending',''))
            try:
                req=urllib.request.Request(TALLY,data=data,headers={'Content-Type':'text/xml; charset=utf-8'},method='POST')
                with urllib.request.urlopen(req,timeout=120) as r: text=r.read(8*1024*1024).decode('utf-8-sig',errors='replace')
                parsed=ET.fromstring(text)
                state='review'
                if parsed.findtext('.//CREATED')=='1' and parsed.findtext('.//ERRORS','0')=='0' and not parsed.findall('.//LINEERROR'):state='confirmed'
                if key:
                    with journal() as c:c.execute('UPDATE posting SET state=?,response=? WHERE key=?',(state,text,key))
                self.reply(200,text)
            except Exception as e:
                if key:
                    with journal() as c:c.execute('UPDATE posting SET state=? WHERE key=?',('unknown',key))
                self.reply(502,'Tally response unavailable. Check Day Book before any retry. '+str(e))
        except Exception as e:self.reply(400,str(e))

if __name__=='__main__':
    print('Balaji Tally connector: http://127.0.0.1:9001 -> Tally port 9000')
    print('Keep this window open. Ctrl+C stops. Posting attempts are retained beside this script.')
    HTTPServer(('127.0.0.1',9001),Handler).serve_forever()
