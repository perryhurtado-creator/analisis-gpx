// Una única serie de acumulados para resumen, explorador y exportaciones.
export function elevationCoverage(points){
  const count=points.reduce((n,p)=>n+Number.isFinite(p.ele),0);
  return !count?'absent':count===points.length?'complete':'partial';
}
export function accumulateElevation(points){
  const status=elevationCoverage(points),starts=[],ends=[];
  let start=0;
  for(let i=0;i<points.length;i++){
    if(!i||points[i].breakBefore||points[i].segmentId!==points[i-1].segmentId||!Number.isFinite(points[i-1].ele)||!Number.isFinite(points[i].ele))start=i;
    starts[i]=start;
  }
  let end=points.length-1;
  for(let i=points.length-1;i>=0;i--){
    if(i===points.length-1||points[i+1].breakBefore||points[i].segmentId!==points[i+1].segmentId||!Number.isFinite(points[i+1].ele)||!Number.isFinite(points[i].ele))end=i;
    ends[i]=end;
  }
  let ascent=0,descent=0,anchor=null,direction=0;
  for(let i=0;i<points.length;i++){
    const p=points[i];let ele=null;
    if(Number.isFinite(p.ele)){
      const blockStart=starts[i],blockEnd=ends[i];
      const blockLength=blockEnd-blockStart+1;
      if(blockLength<4||i===blockStart||i===blockEnd){
        ele=p.ele;
      }else{
        let sum=0,count=0;
        for(let j=Math.max(blockStart,i-2);j<=Math.min(blockEnd,i+2);j++){sum+=points[j].ele;count++}
        ele=sum/count;
      }
    }
    if(ele===null){anchor=null;direction=0}
    else if(i===starts[i]||anchor===null){anchor=ele;direction=0}
    else if(p.d>points[i-1].d){
      const delta=ele-anchor;
      if(direction===0){
        if(delta>=1){ascent+=delta;anchor=ele;direction=1}
        else if(delta<=-1){descent-=delta;anchor=ele;direction=-1}
      }else if(direction===1){
        if(delta>0){ascent+=delta;anchor=ele}
        else if(delta<=-1){descent-=delta;anchor=ele;direction=-1}
      }else{
        if(delta<0){descent-=delta;anchor=ele}
        else if(delta>=1){ascent+=delta;anchor=ele;direction=1}
      }
    }
    p.up=status==='absent'?null:ascent;
    p.down=status==='absent'?null:descent;
  }
  return {ascent:status==='absent'?null:ascent,descent:status==='absent'?null:descent,elevationStatus:status};
}
