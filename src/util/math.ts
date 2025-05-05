/**
 * 区域缩放 将[a,b]内的值映射到[c,d]
 * @param value 值 
 * @param a 所在域左
 * @param b 所在域右
 * @param c 目标域左
 * @param d 目标域右
 * @returns 
 */
export function RegionZoom(value:number,a:number,b:number,c:number,d:number):number{
  //偏移c加上百分比对应的值就是缩放后的值
  return c+(value-a)/(b-a)*(d-c);
}