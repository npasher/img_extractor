const fs=require("fs");
const md5=require("md5");
const async=require("async");
const puppeteer=require("puppeteer"); //Headless browser which will automate browser tests.//
const request=require("request-promise"); //Hashes urls.//

async function scrollDown(page){
  try{
    await page.evaluate(
      async ()=>
        new Promise((resolve,reject)=>{
          try{
            let maxIntervals=25;
            const interval=setInterval(()=>{
              const offset=document.body.offsetHeight;
              const {scrollY,screen:{height}}=window;
              window.scrollBy(0,offset);
              if (maxIntervals>0 && offset - scrollY>height){
                maxIntervals -= 1;
              }else{
                clearInterval(interval);
                resolve();
              }
            },1500);
          }catch (error){
            reject(error);
          }
        })
    );
  }catch (error){
    console.log("Scrolling Error:",error);
  }finally{
    console.log("Scrolling Complete.");
  }
}

const downloadDir=(dirname,count=0)=>async(uri)=>{
  const response=await request({uri,encoding:null});
  const buffer=Buffer.from(response,'utf8');
  return new Promise((resolve,reject) =>{
    fs.writeFile(`${dirname}/${md5(uri).slice(7)}.jpg`,buffer,(err)=>{
      if (err){
        return reject(err);
      }
      console.log("Images saved:",++count);
      return resolve();
    });
  });
};

async function imageExtraction(imageName){
  const dirname=fs.mkdtempSync(`images-${imageName}`);
  if (!fs.existsSync(dirname)){
    fs.mkdirSync("./images");
  }
  const imageUrl="https://www.google.com/search?q=${imageName}&tbm=isch";

  console.log("Browser Launch.");

  const browser=await puppeteer.launch({headless:true});

  console.log("Page Launch.");
  const page = await browser.newPage();
  console.log("Going to:",imageUrl);
  await page.goto(imageUrl);

  const imagesUrls=[];
  const downloadImage=downloadDir(dirname);
  const imagesQueue=async.queue(async.asyncify(downloadImage),6);

  page.on("response",(interceptedResponse)=>{
    const request=interceptedResponse.request();
    const resource=request.resourceType();
    if(resource==="image"){
      const url=request.url();
      if(url.indexOf("images")>0){
        imagesUrls.push(url);
        imagesQueue.push(url);
      }
    }
  });

  await scrollDown(page);
  console.log("Clicking 'Show more'");
  page.click('#smb');
  await scrollDown(page);

  if (imagesQueue.length()){
    console.log("Items in queue:",imagesQueue.length());
    await new Promise((resolve)=>{
      imagesQueue.drain=resolve;
    });
  }
  await browser.close();
  return imagesUrls.length;
}

(async()=>{
  const [nodePath,currentPath, ...args]=process.argv;
  if (args.length){
    const [imageName]=args;
    console.log("Searching Google Images for '${imageName}'.");
    const totalImages=await imageExtraction(imageName);
    console.log("Downloaded images:",totalImages);
    return console.log("Complete.");
  }
  return console.log(" 'imageName' argument required.");
})();