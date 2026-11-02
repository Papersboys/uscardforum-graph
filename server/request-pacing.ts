/** Add jitter once per request; it never shortens the configured minimum. */
export function requestGap(interval:number,jitter:number,random=Math.random){
 const value=random();const fraction=Number.isFinite(value)?Math.max(0,Math.min(value,1)):0;
 return Math.max(0,interval)+Math.floor(Math.max(0,jitter)*fraction);
}
export function retryWait(attempt:number,retryAfter:number,random=Math.random){
 return requestGap(Math.max(30000*2**attempt,Number.isFinite(retryAfter)?retryAfter:0),1000,random);
}
