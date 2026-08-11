const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// ============================================================
// 1. "+" BUTTON — smaller, bordered, different look
// ============================================================
html = html.replace(
  '<button class="pill" style="color:var(--green);border-color:var(--green)" data-action="cat-add" title="Add category">+</button>',
  '<button class="cat-add-btn" data-action="cat-add" title="Add category">+</button>'
);
console.log('[OK] + button: using custom class');

// Add CSS for the new + button (insert before .pill styles)
html = html.replace(
  '.pill{display:inline-flex',
  `.cat-add-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1.5px dashed var(--green);border-radius:4px;background:transparent;color:var(--green);font-size:14px;font-weight:700;cursor:pointer;transition:.13s;line-height:1;padding:0;margin-left:4px}
  .cat-add-btn:hover{background:rgba(51,209,122,.12);border-style:solid;box-shadow:0 0 8px rgba(51,209,122,.3)}
  .pill{display:inline-flex`
);
console.log('[OK] + button CSS added');

// ============================================================
// 2. COLOR PICKER — remove Random button, bigger color preview
// ============================================================
html = html.replace(
  `'case "cat-add": { openModal("New Category", \\'<div class="field"><label>Category name</label><input id="cat_name" placeholder="e.g. Tutorials"></div><div class="field"><label>Color</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cat_color" value="#27b4ff" style="width:40px;height:32px;border:1px solid var(--border);border-radius:4px;background:var(--input);cursor:pointer"><button class="btn sm" data-action="cat-randcolor" style="font-size:11px">Random</button></div></div>\\', "Create"`,
  `'case "cat-add": { openModal("New Category", \\'<div class="field"><label>Category name</label><input id="cat_name" placeholder="e.g. Tutorials"></div><div class="field"><label>Color</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cat_color" value="#27b4ff" style="width:48px;height:36px;border:2px solid var(--border);border-radius:4px;background:var(--input);cursor:pointer;padding:2px"></div></div>\\', "Create"`
);

// Also need to fix this - the actual string in the file might be different
// Let me search for the actual cat-add case content
let catAddIdx = html.indexOf('case "cat-add":');
if (catAddIdx >= 0) {
  let catAddEnd = html.indexOf('break; }', catAddIdx);
  if (catAddEnd >= 0) {
    catAddEnd += 'break; }'.length;
    let oldCatAdd = html.slice(catAddIdx, catAddEnd);
    let newCatAdd = `case "cat-add": { openModal("New Category", '<div class="field"><label>Category name</label><input id="cat_name" placeholder="e.g. Tutorials"></div><div class="field"><label>Color</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cat_color" value="#27b4ff" style="width:48px;height:36px;border:2px solid var(--border);border-radius:4px;background:var(--input);cursor:pointer;padding:2px"></div></div>', "Create", function(){ var name=($("#cat_name")||{}).value||""; name=name.trim(); if(!name){ toast("Name required","warn"); return; } var cc=CAT_COLORS[name]; if(cc&&(!state.categories||!state.categories[name])&&DEFAULT_CATS[name]){ toast("Category already exists","warn"); return; } if(state.categories&&state.categories[name]){ toast("Category already exists","warn"); return; } var color=($("#cat_color")||{}).value||"#27b4ff"; addCategory(name,color); closeModal(); toast("Category created: "+name,"ok"); }); setTimeout(function(){ var i=document.getElementById("cat_name"); if(i) i.focus(); },30); break; }`;
    html = html.slice(0, catAddIdx) + newCatAdd + html.slice(catAddEnd);
    console.log('[OK] cat-add modal: removed Random button, bigger color picker');
  }
}

// Remove the cat-randcolor handler since we don't need it anymore
html = html.replace(
  "\n    case \"cat-randcolor\": { var ci=document.getElementById(\"cat_color\"); if(ci) ci.value=randomColor(); break; }",
  ""
);
console.log('[OK] removed cat-randcolor handler');

// ============================================================
// 3. DELETE CATEGORY — remove from context menu, add × on pills
// ============================================================
// Remove the delete category option from link context menu
html = html.replace(
  '+(l.category&&state.categories&&state.categories[l.category]?`<div class="cdiv"></div>`+mi("cat-delete",l.category,"Delete category \\""+l.category+"\\"","#ff5470",true):"")+"',
  '+'
);
console.log('[OK] removed delete from context menu');

// Make category pills show × for custom categories
// We need to modify the pills template in viewLinks to add × on custom categories
// First, let's change the pill generation for categories to include a delete button
// The pills are generated with: Object.keys(CAT_COLORS).map(c=>pill(c,linkCat===c,...))
// We need to make custom categories show a × button

// Replace the category pill rendering in viewLinks
const oldCatPills = `Object.keys(CAT_COLORS).map(c=>pill(c,linkCat===c,CAT_COLORS[c],'data-action="link-cat" data-cat="\\'+esc(c)+\\'"')).join("")`;
const newCatPills = `Object.keys(CAT_COLORS).map(c=>{ var isActive=linkCats.indexOf(c)>=0; var p=pill(c,isActive,CAT_COLORS[c],'data-action="link-cat" data-cat="\\'+esc(c)+\\'"'); if(state.categories&&state.categories[c]){ p=p.replace('</button>','<span class="cat-del" data-action="cat-del-pill" data-cat="'+esc(c)+'" title="Delete category" style="margin-left:4px;opacity:.5;font-size:10px;cursor:pointer" onclick="event.stopPropagation()">\\u00d7</span></button>'); } return p; }).join("")`;

if (html.indexOf(oldCatPills) >= 0) {
  html = html.replace(oldCatPills, newCatPills);
  console.log('[OK] category pills: × delete button on custom cats');
} else {
  console.log('[WARN] Could not find cat pills template');
  // Try alternate search
  let search = `Object.keys(CAT_COLORS).map(c=>pill(c,`;
  let idx = html.indexOf(search);
  if (idx >= 0) {
    console.log('[INFO] Found at index ' + idx + ': ' + html.slice(idx, idx+120));
  }
}

// Add the cat-del-pill handler
html = html.replace(
  '    case "cat-delete":',
  '    case "cat-del-pill": { var cn2=(t.dataset.cat||"").trim(); if(cn2){ confirmModal("Delete category \\""+cn2+"\\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn2); toast("Category deleted","ok"); } }); } break; }\n    case "cat-delete":'
);
console.log('[OK] cat-del-pill handler added');

// Add CSS for × on pills
html = html.replace(
  '.cat-add-btn:hover{',
  '.pill .cat-del{transition:.13s} .pill .cat-del:hover{opacity:1!important;color:var(--red)}\n  .cat-add-btn:hover{'
);
console.log('[OK] × delete CSS added');

// ============================================================
// 4. MULTI-SELECT CATEGORIES
// ============================================================
// Change linkCat from string to array (linkCats)
html = html.replace(
  'let linkCat="all", linkFav=false,',
  'let linkCats=["all"], linkFav=false,'
);
console.log('[OK] linkCat -> linkCats array');

// Update the link-cat click handler
html = html.replace(
  'case "link-cat": linkCat=t.dataset.cat; renderView(); break;',
  'case "link-cat": { var c=t.dataset.cat; if(c==="all"){ linkCats=["all"]; } else { var idx=linkCats.indexOf("all"); if(idx>=0) linkCats.splice(idx,1); var ci=linkCats.indexOf(c); if(ci>=0) linkCats.splice(ci,1); else linkCats.push(c); if(!linkCats.length) linkCats=["all"]; } renderView(); break; }'
);
console.log('[OK] link-cat handler: multi-select toggle');

// Update viewLinks filter to support multiple categories
html = html.replace(
  'const catOk=linkCat==="all"||normCat(l)===linkCat;',
  'const catOk=linkCats.indexOf("all")>=0||linkCats.indexOf(normCat(l))>=0||(!normCat(l)&&linkCats.indexOf("")>=0);'
);
console.log('[OK] viewLinks filter: multi-category');

// Update "All" pill to use linkCats
html = html.replace(
  `pill("All",linkCat==="all",ALL_COLOR,'data-action="link-cat" data-cat="all"')`,
  `pill("All",linkCats.indexOf("all")>=0,ALL_COLOR,'data-action="link-cat" data-cat="all"')`
);
console.log('[OK] All pill: uses linkCats');

// Update the category pill active check (in the newCatPills we already did this)
// But we also need to update the old pill rendering in case the replacement didn't work
// Let's search for the old pattern
let oldPillCheck = `linkCat===c`;
let pillCheckCount = 0;
while (html.indexOf(oldPillCheck) >= 0) {
  html = html.replace(oldPillCheck, 'linkCats.indexOf(c)>=0');
  pillCheckCount++;
}
console.log('[OK] replaced ' + pillCheckCount + ' linkCat===c references');

// Update normCat references for empty category
// Also update the context menu category check
html = html.replace(
  'miCat(id,c,normCat(l)===c)',
  'miCat(id,c,normCat(l)===c)'
);
// This one is fine as-is since it's about setting a single link's category

// Update the head description
html = html.replace(
  'return head("Link Saver",""+openVerb()+" · ctrl-click to select · Delete to remove")',
  'return head("Link Saver",""+openVerb()+" · click multiple categories · ctrl-click cards to select")'
);
console.log('[OK] updated Links head description');

fs.writeFileSync('index.html', html);
console.log('[OK] index.html written');

// ============================================================
// VERIFY
// ============================================================
const vm = require('vm');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if(scriptMatch){
  try {
    new vm.Script(scriptMatch[1]);
    console.log('\nindex.html script: VALID');
  } catch(e){
    console.log('\nindex.html script ERROR:', e.message);
  }
}
