//加载文件
export function LoadFile(url:string):Promise<ArrayBuffer|null>{
  const promise=new Promise<ArrayBuffer>((resolve,reject)=>{
    const request:XMLHttpRequest=new XMLHttpRequest();
    request.open('GET',url,true);
    request.responseType='arraybuffer';
    request.onload=()=>{
      resolve(request.response);
    };
    request.onerror=function(this: XMLHttpRequest){
      reject(null);
    };
    request.send();
  });
  return promise;
}