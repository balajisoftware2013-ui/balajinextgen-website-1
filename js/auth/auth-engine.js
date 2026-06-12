/********************************************************
 BALAJI NEXTGEN ERP
 AUTH ENGINE
 FILE:
 js/auth/auth-engine.js
********************************************************/

/* =====================================================
AUTH STATE
===================================================== */

const ERP_AUTH = {

LOGIN_LOADING : false,

OTP_LOADING : false,

CURRENT_OTP_USER : '',

LOGIN_MODE : 'PASSWORD'

};

/* =====================================================
INITIALIZE AUTH
===================================================== */

function initializeERPAuth(){

try{

console.log(
'ERP AUTH ENGINE STARTED'
);

/* =====================================================
CHECK SESSION
===================================================== */

const session =
loadERPSession();

if(session){

redirectToDashboard();

return;

}

/* =====================================================
LOAD LOGIN EVENTS
===================================================== */

bindLoginEvents();

/* =====================================================
LOAD OTP EVENTS
===================================================== */

bindOTPEvents();

/* =====================================================
DEFAULT MODE
===================================================== */

showPasswordLogin();

}catch(error){

console.log(
'AUTH ENGINE ERROR:',
error
);

}

}

/* =====================================================
LOGIN EVENTS
===================================================== */

function bindLoginEvents(){

const loginButton =
document.getElementById(
'loginButton'
);

if(loginButton){

loginButton.addEventListener(

'click',

function(){

loginERPUser();

}

);

}

/* =====================================================
ENTER KEY
===================================================== */

document.addEventListener(

'keypress',

function(event){

if(event.key === 'Enter'){

if(
ERP_AUTH.LOGIN_MODE === 'PASSWORD'
){

loginERPUser();

}else{

verifyERPOTP();

}

}

}

);

}

/* =====================================================
OTP EVENTS
===================================================== */

function bindOTPEvents(){

const sendOTPButton =
document.getElementById(
'sendOTPButton'
);

if(sendOTPButton){

sendOTPButton.addEventListener(

'click',

function(){

sendERPOTP();

}

);

}

const verifyOTPButton =
document.getElementById(
'verifyOTPButton'
);

if(verifyOTPButton){

verifyOTPButton.addEventListener(

'click',

function(){

verifyERPOTP();

}

);

}

}

/* =====================================================
PASSWORD LOGIN
===================================================== */

async function loginERPUser(){

try{

if(ERP_AUTH.LOGIN_LOADING){

return;

}

/* =====================================================
INPUTS
===================================================== */

const loginId =
document.getElementById(
'loginId'
).value.trim();

const password =
document.getElementById(
'password'
).value.trim();

/* =====================================================
VALIDATION
===================================================== */

if(!loginId){

showMessage(
'ENTER EMAIL OR MOBILE',
'error'
);

return;

}

if(!password){

showMessage(
'ENTER PASSWORD',
'error'
);

return;

}

/* =====================================================
START
===================================================== */

ERP_AUTH.LOGIN_LOADING =
true;

showLoader();

/* =====================================================
LOAD APIs
===================================================== */

if(!ERP_API.LOADED){

await loadERPAPI();

}

/* =====================================================
LOGIN API
===================================================== */

const result =
await callERPAPI(

ERP_API.AUTH,

{

action : 'LOGIN',

loginId : loginId,

password : password

}

);

console.log(
'LOGIN RESULT:',
result
);

/* =====================================================
SUCCESS
===================================================== */

if(
result.data
&&
result.data.status === 'success'
){

saveERPSession(
result.data
);

showMessage(
'LOGIN SUCCESS',
'success'
);

setTimeout(function(){

redirectToDashboard();

},1000);

}else{

showMessage(

result.data
?
result.data.message
:
'LOGIN FAILED',

'error'

);

}

/* =====================================================
STOP
===================================================== */

hideLoader();

ERP_AUTH.LOGIN_LOADING =
false;

}catch(error){

hideLoader();

ERP_AUTH.LOGIN_LOADING =
false;

console.log(
'LOGIN ERROR:',
error
);

showMessage(
'SERVER ERROR',
'error'
);

}

}

/* =====================================================
SEND OTP
===================================================== */

async function sendERPOTP(){

try{

const mobile =
document.getElementById(
'otpMobile'
).value.trim();

/* =====================================================
VALIDATE
===================================================== */

if(!mobile){

showMessage(
'ENTER MOBILE NUMBER',
'error'
);

return;

}

showLoader();

/* =====================================================
LOAD APIs
===================================================== */

if(!ERP_API.LOADED){

await loadERPAPI();

}

/* =====================================================
API CALL
===================================================== */

const result =
await callERPAPI(

ERP_API.AUTH,

{

action : 'SEND_OTP',

loginId : mobile

}

);

console.log(
'OTP RESULT:',
result
);

/* =====================================================
SUCCESS
===================================================== */

if(
result.data
&&
result.data.status === 'success'
){

ERP_AUTH.CURRENT_OTP_USER =
mobile;

showMessage(
'OTP SENT SUCCESSFULLY',
'success'
);

}else{

showMessage(
'OTP SEND FAILED',
'error'
);

}

hideLoader();

}catch(error){

hideLoader();

console.log(
'OTP ERROR:',
error
);

showMessage(
'SERVER ERROR',
'error'
);

}

}

/* =====================================================
VERIFY OTP
===================================================== */

async function verifyERPOTP(){

try{

const mobile =
document.getElementById(
'otpMobile'
).value.trim();

const otp =
document.getElementById(
'otpCode'
).value.trim();

/* =====================================================
VALIDATE
===================================================== */

if(!mobile){

showMessage(
'ENTER MOBILE NUMBER',
'error'
);

return;

}

if(!otp){

showMessage(
'ENTER OTP',
'error'
);

return;

}

showLoader();

/* =====================================================
LOAD APIs
===================================================== */

if(!ERP_API.LOADED){

await loadERPAPI();

}

/* =====================================================
VERIFY API
===================================================== */

const result =
await callERPAPI(

ERP_API.AUTH,

{

action : 'VERIFY_OTP',

loginId : mobile,

otp : otp

}

);

console.log(
'VERIFY RESULT:',
result
);

/* =====================================================
SUCCESS
===================================================== */

if(
result.data
&&
result.data.status === 'success'
){

saveERPSession(
result.data
);

showMessage(
'OTP LOGIN SUCCESS',
'success'
);

setTimeout(function(){

redirectToDashboard();

},1000);

}else{

showMessage(
'INVALID OTP',
'error'
);

}

hideLoader();

}catch(error){

hideLoader();

console.log(
'VERIFY OTP ERROR:',
error
);

showMessage(
'SERVER ERROR',
'error'
);

}

}

/* =====================================================
SHOW PASSWORD LOGIN
===================================================== */

function showPasswordLogin(){

ERP_AUTH.LOGIN_MODE =
'PASSWORD';

const passwordSection =
document.getElementById(
'passwordLoginSection'
);

const otpSection =
document.getElementById(
'otpLoginSection'
);

if(passwordSection){

passwordSection.style.display =
'block';

}

if(otpSection){

otpSection.style.display =
'none';

}

}

/* =====================================================
SHOW OTP LOGIN
===================================================== */

function showOTPLogin(){

ERP_AUTH.LOGIN_MODE =
'OTP';

const passwordSection =
document.getElementById(
'passwordLoginSection'
);

const otpSection =
document.getElementById(
'otpLoginSection'
);

if(passwordSection){

passwordSection.style.display =
'none';

}

if(otpSection){

otpSection.style.display =
'block';

}

}

/* =====================================================
TOGGLE PASSWORD
===================================================== */

function togglePassword(){

const password =
document.getElementById(
'password'
);

if(!password){

return;

}

password.type =
password.type === 'password'
?
'text'
:
'password';

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPAuth();

}

);