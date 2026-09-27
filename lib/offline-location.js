"use strict";
const fs=require("fs"),path=require("path");
const NAME="SINRAD Offline Storage";
function resolveOfflineLocation(chosen,documents){
  const target=path.join(documents,NAME);
  let source=chosen;
  if(!source)source=[target,path.join(documents,"Sinrad Offline"),path.join(documents,"Offline Mode")].find(p=>fs.existsSync(path.join(p,"feed.json")))||target;
  source=path.resolve(source);
  if(!["offline mode","sinrad offline"].includes(path.basename(source).toLowerCase()))return source;
  const destination=path.join(path.dirname(source),NAME);
  // Never merge two libraries or traverse junctions during a rename.
  try{if(!fs.existsSync(source))return fs.existsSync(destination)?destination:source;
    const st=fs.lstatSync(source);if(!st.isDirectory()||st.isSymbolicLink()||fs.existsSync(destination))return source;
    fs.renameSync(source,destination);return destination;
  }catch(_){return source;}
}
module.exports={resolveOfflineLocation,NAME};
