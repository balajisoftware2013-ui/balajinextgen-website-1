/** Replace the matching functions in the existing CRM project. Do not keep duplicate definitions.
 * Credential presence is not a connectivity test. Diagnostic sends nothing and creates no guests.
 */
function bnxWaEffective_(cid) {
 var p=PropertiesService.getScriptProperties(),pr=function(k){return bnxCrmProp_(p,k,cid);};
 var provider=String(pr('WA_PROVIDER')||'NONE').trim().toUpperCase();
 if(provider==='META')return pr('META_WA_TOKEN')&&/^\d{12,20}$/.test(String(pr('META_WA_PHONE_ID')||'').trim())?'META':'NONE';
 if(provider==='TWILIO')return pr('TWILIO_SID')&&pr('TWILIO_TOKEN')&&/^whatsapp:\+\d{8,15}$/i.test(String(pr('TWILIO_FROM_WA')||''))?'TWILIO':'NONE';
 return 'NONE';
}
function bnxGuestCfg_(cid){
 var p=PropertiesService.getScriptProperties(),pr=function(k){return bnxCrmProp_(p,k,cid);};
 var wa=bnxWaEffective_(cid),key=pr('TRUECALLER_PARTNER_KEY');
 return {otp:bnxOtpChannel_(cid)!=='',whatsapp:wa==='META',privacyUrl:pr('PRIVACY_URL')||'',ctl:bnxGuestCtl_(cid),
 waNumber:String(pr('WA_GUEST_NUMBER')||'').replace(/\D/g,'').slice(-10),waApi:wa!=='NONE',freeMode:wa==='NONE',
 truecaller:key?{partnerKey:key,partnerName:pr('TRUECALLER_PARTNER_NAME')||pr('RESTAURANT_NAME')||'Restaurant',privacyUrl:pr('TRUECALLER_PRIVACY_URL')||'',termsUrl:pr('TRUECALLER_TERMS_URL')||''}:null};
}
function bnxSendWelcome_(mobile,name,clientId,crn){
 var p=PropertiesService.getScriptProperties(),pr=function(k){return bnxCrmProp_(p,k,clientId);};
 var restaurant=pr('RESTAURANT_NAME')||bnxCrmRestaurantName_(clientId),first=String(name||'').trim().split(/\s+/)[0]||'Guest';
 var tpl=pr('WELCOME_TEXT')||(crn?'Hi {name}, welcome to {restaurant}! Your customer number is {crn}. Enjoy your meal.':'Hi {name}, welcome to {restaurant}! Enjoy your meal.');
 var message=tpl.replace(/\{name\}/g,first).replace(/\{restaurant\}/g,restaurant).replace(/\{crn\}/g,crn||'');
 var wa=bnxWaEffective_(clientId),sms=String(pr('SMS_PROVIDER')||'NONE').toUpperCase(),results=[];
 try{
 if(wa==='META')results.push(['WHATSAPP',metaWa_(pr,mobile,[first,restaurant,crn||'-'])]);
 else if(wa==='TWILIO')results.push(['WHATSAPP',twilioWa_(p,pr,mobile,message,[first,restaurant,crn||'-'])]);
 }catch(e){results.push(['WHATSAPP','ERR '+e.message]);}
 var sent=results.some(function(x){return /^OK\b/i.test(String(x[1]));});
 if(!sent)try{
 if(sms==='FAST2SMS'&&pr('FAST2SMS_KEY'))results.push(['SMS',fast2sms_(pr,mobile,message)]);
 else if(sms==='MSG91'&&pr('MSG91_AUTH_KEY'))results.push(['SMS',msg91_(pr,mobile,first,restaurant)]);
 else if(sms==='TWILIO'&&pr('TWILIO_SID')&&pr('TWILIO_TOKEN')&&pr('TWILIO_FROM_SMS'))results.push(['SMS',twilio_(pr,'+91'+mobile,pr('TWILIO_FROM_SMS'),message)]);
 }catch(e){results.push(['SMS','ERR '+e.message]);}
 var ok=results.filter(function(x){return /^OK\b/i.test(String(x[1]));})[0],free=wa==='NONE'&&results.length===0;
 try{bnxCrmAppend_(bnxCrmSheet_(CRM_LOG,CRM_LOG_HEAD,clientId),{TIME:bnxNow_(),MOBILE:mobile,CHANNEL:ok?ok[0]:(free?'FREE_WA':'NONE'),RESULT:free?'FREE MODE: manual WhatsApp tap required':JSON.stringify(results).slice(0,300),TEXT:message,CLIENT_ID:clientId||''});}catch(e){Logger.log('WELCOME_LOG: '+e.message);}
 return {ok:!!ok,channel:ok?ok[0]:(free?'FREE_WA':''),configured:wa!=='NONE'||sms!=='NONE',free:free};
}
function BNX_FREE_WA_CHECK_SAFE(){
 var cid=typeof CRM_TEST_CLIENT!=='undefined'?CRM_TEST_CLIENT:'CL00010',cfg=bnxGuestCfg_(cid);
 Logger.log(JSON.stringify({clientId:cid,effectiveMode:bnxWaEffective_(cid),waApi:cfg.waApi,freeMode:cfg.freeMode,hasGuestNumber:/^[6-9]\d{9}$/.test(cfg.waNumber)}));
}
