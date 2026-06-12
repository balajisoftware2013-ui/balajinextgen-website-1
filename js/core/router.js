function openModule(page){

document
.getElementById(
'erpContent'
)
.innerHTML =

`
<iframe
src="${page}"
style="
width:100%;
height:85vh;
border:none;
border-radius:20px;
background:white;
">
</iframe>
`;

}