/********************************************************
 BALAJI NEXTGEN ERP
 THEME ENGINE
 FILE:
 js/utilities/theme-engine.js
********************************************************/

/* =====================================================
THEME STATE
===================================================== */

const ERP_THEME = {

CURRENT : 'light',

AVAILABLE : [

'light',
'dark',
'blue',
'green',
'purple'

]

};

/* =====================================================
INITIALIZE THEME
===================================================== */

function initializeERPTheme(){

try{

/* =====================================================
LOAD SAVED
===================================================== */

const savedTheme =
localStorage.getItem(
'ERP_THEME'
);

/* =====================================================
SET SAVED
===================================================== */

if(savedTheme){

setERPTheme(
savedTheme
);

}else{

setERPTheme(
'light'
);

}

console.log(
'THEME ENGINE STARTED'
);

}catch(error){

console.log(
'THEME ENGINE ERROR:',
error
);

}

}

/* =====================================================
SET THEME
===================================================== */

function setERPTheme(
theme
){

try{

/* =====================================================
INVALID
===================================================== */

if(
!ERP_THEME.AVAILABLE.includes(
theme
)
){

theme = 'light';

}

/* =====================================================
SAVE
===================================================== */

ERP_THEME.CURRENT =
theme;

/* =====================================================
BODY ATTRIBUTE
===================================================== */

document.body.setAttribute(
'data-theme',
theme
);

/* =====================================================
LOCAL STORAGE
===================================================== */

localStorage.setItem(
'ERP_THEME',
theme
);

/* =====================================================
APPLY COLORS
===================================================== */

applyERPThemeColors(
theme
);

console.log(
'THEME SET:',
theme
);

}catch(error){

console.log(
'SET THEME ERROR:',
error
);

}

}

/* =====================================================
APPLY COLORS
===================================================== */

function applyERPThemeColors(
theme
){

const root =
document.documentElement;

/* =====================================================
LIGHT
===================================================== */

if(theme === 'light'){

root.style.setProperty(
'--erp-bg',
'#f8fafc'
);

root.style.setProperty(
'--erp-card',
'#ffffff'
);

root.style.setProperty(
'--erp-text',
'#0f172a'
);

root.style.setProperty(
'--erp-primary',
'#2563eb'
);

}

/* =====================================================
DARK
===================================================== */

if(theme === 'dark'){

root.style.setProperty(
'--erp-bg',
'#0f172a'
);

root.style.setProperty(
'--erp-card',
'#1e293b'
);

root.style.setProperty(
'--erp-text',
'#ffffff'
);

root.style.setProperty(
'--erp-primary',
'#3b82f6'
);

}

/* =====================================================
BLUE
===================================================== */

if(theme === 'blue'){

root.style.setProperty(
'--erp-bg',
'#eff6ff'
);

root.style.setProperty(
'--erp-card',
'#dbeafe'
);

root.style.setProperty(
'--erp-text',
'#1e3a8a'
);

root.style.setProperty(
'--erp-primary',
'#2563eb'
);

}

/* =====================================================
GREEN
===================================================== */

if(theme === 'green'){

root.style.setProperty(
'--erp-bg',
'#ecfdf5'
);

root.style.setProperty(
'--erp-card',
'#d1fae5'
);

root.style.setProperty(
'--erp-text',
'#065f46'
);

root.style.setProperty(
'--erp-primary',
'#10b981'
);

}

/* =====================================================
PURPLE
===================================================== */

if(theme === 'purple'){

root.style.setProperty(
'--erp-bg',
'#f5f3ff'
);

root.style.setProperty(
'--erp-card',
'#ede9fe'
);

root.style.setProperty(
'--erp-text',
'#5b21b6'
);

root.style.setProperty(
'--erp-primary',
'#7c3aed'
);

}

}

/* =====================================================
TOGGLE DARK MODE
===================================================== */

function toggleERPDarkMode(){

if(
ERP_THEME.CURRENT === 'dark'
){

setERPTheme(
'light'
);

}else{

setERPTheme(
'dark'
);

}

}

/* =====================================================
NEXT THEME
===================================================== */

function nextERPTheme(){

const currentIndex =
ERP_THEME.AVAILABLE.indexOf(
ERP_THEME.CURRENT
);

let nextIndex =
currentIndex + 1;

if(
nextIndex >=
ERP_THEME.AVAILABLE.length
){

nextIndex = 0;

}

setERPTheme(
ERP_THEME.AVAILABLE[
nextIndex
]
);

}

/* =====================================================
THEME PANEL
===================================================== */

function openThemePanel(){

const panel =
document.getElementById(
'erpThemePanel'
);

if(!panel){

return;

}

panel.style.display =
'block';

}

/* =====================================================
CLOSE PANEL
===================================================== */

function closeThemePanel(){

const panel =
document.getElementById(
'erpThemePanel'
);

if(!panel){

return;

}

panel.style.display =
'none';

}

/* =====================================================
GENERATE PANEL
===================================================== */

function generateThemePanel(){

if(
document.getElementById(
'erpThemePanel'
)
){

return;

}

const panel =
document.createElement(
'div'
);

panel.id =
'erpThemePanel';

panel.style.position =
'fixed';

panel.style.top =
'90px';

panel.style.right =
'20px';

panel.style.width =
'260px';

panel.style.background =
'#ffffff';

panel.style.borderRadius =
'20px';

panel.style.padding =
'20px';

panel.style.boxShadow =
'0 20px 50px rgba(0,0,0,0.15)';

panel.style.zIndex =
'999999';

panel.style.display =
'none';

/* =====================================================
HTML
===================================================== */

panel.innerHTML = `

<h2
style="
margin-bottom:20px;
font-size:20px;
font-weight:700;
"
>

Theme Settings

</h2>

<div
class="erp-theme-item"
onclick="setERPTheme('light')"
>

☀️ Light Theme

</div>

<div
class="erp-theme-item"
onclick="setERPTheme('dark')"
>

🌙 Dark Theme

</div>

<div
class="erp-theme-item"
onclick="setERPTheme('blue')"
>

💙 Blue Theme

</div>

<div
class="erp-theme-item"
onclick="setERPTheme('green')"
>

💚 Green Theme

</div>

<div
class="erp-theme-item"
onclick="setERPTheme('purple')"
>

💜 Purple Theme

</div>

<button
onclick="closeThemePanel()"
class="erp-btn"
style="
margin-top:20px;
width:100%;
"
>

Close

</button>

`;

document.body.appendChild(
panel
);

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPTheme();

generateThemePanel();

}

);