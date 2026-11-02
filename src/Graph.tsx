import {localeTools} from './i18n';
import {useCallback,useEffect,useMemo,useRef} from 'react';
import {RelationGraph,RGHooks,type RGNodeSlotProps,type RGOptions} from '@relation-graph/react';
import type {Dataset,Edge} from '../server/graph';
import {userColor,edgeKey} from './data';
import {Icon} from './icons';
import {pathIncludesEdge,type ConnectionPath} from './analysis';
export type Layout='fixed'|'force'|'circle';
const nodeSlot=({node,checked}:RGNodeSlotProps)=><div className={`graph-person ${checked?'is-selected':''} ${node.data?.inPath?'is-path':''}`} title={node.text}><span className="node-avatar" style={{background:userColor(node.id)}}>{Array.from(node.text??'')[0]?.toUpperCase()}</span><span className="node-name">{node.text}</span></div>;
export default function Graph({data,edges,selected,layout,zh,onSelect,onEdge,path,showWeights,hideIsolated}:{data:Dataset;edges:Edge[];selected:string;layout:Layout;zh:boolean;path:ConnectionPath|null;showWeights:boolean;hideIsolated:boolean;onSelect:(id:string)=>void;onEdge:(edge:Edge)=>void}){
 const instance=RGHooks.useGraphInstance();const current=useRef({edges,onEdge,onSelect,selected,path,showWeights,zh});current.current={edges,onEdge,onSelect,selected,path,showWeights,zh};
 const highlight=useCallback((id:string)=>{
  const activePath=current.current.path;
  instance.updateOptions({checkedNodeId:id});
  for(const line of instance.getLines()){
   const pathEdge=pathIncludesEdge(activePath,line);
   const connected=activePath?pathEdge:line.from===id||line.to===id;
   instance.updateLine(line.id,{opacity:connected?1:.22,color:pathEdge?'#d79b45':line.dashType?(connected?'#9a79b9':'#b9a4cd'):(connected?'#6c8bb5':'#a6b8cc'),text:current.current.showWeights?new Intl.NumberFormat(current.current.zh?'zh-CN':'en-US').format(line.data?.weight??0):'',lineWidth:pathEdge?3:1+Math.min((line.data?.weight??1)/5,2)});
  }
  const pathIds=new Set(activePath?.nodes??[]);
  for(const node of instance.getNodes())instance.updateNode(node.id,{data:{...node.data,inPath:pathIds.has(node.id)}});
  instance.dataUpdated();
 },[instance]);
 const options=useMemo<RGOptions>(()=>({debug:false,showToolBar:false,defaultNodeBorderWidth:0,defaultNodeColor:'transparent',defaultLineShape:1,defaultLineColor:'#b8c5d3',layout:{layoutName:'fixed'},defaultLineWidth:1.5}),[]);
 useEffect(()=>{
  let disposed=false;
  const visibleIds=new Set(edges.flatMap(e=>[e.from,e.to]));
  // Isolate visibility is explicit, independent of edge count or selection.
  const users=hideIsolated?data.users.filter(u=>visibleIds.has(u.id)):data.users;
  if(!users.length){instance.clearGraph();return;}
  const cols=Math.max(2,Math.ceil(Math.sqrt(users.length*1.3)));
  instance.updateOptions({layout:{layoutName:layout,force_node_repulsion:.5,force_line_elastic:1.4},checkedNodeId:selected});
  void instance.setJsonData({rootId:users.find(u=>u.id===selected)?.id??users[0]?.id??'',nodes:users.map((u,i)=>({id:u.id,text:u.username,width:108,height:72,nodeShape:1,color:'transparent',borderWidth:0,x:(i%cols)*137+(Math.floor(i/cols)%2)*28,y:Math.floor(i/cols)*118,data:{posts:u.posts}})),lines:edges.map((e,i)=>({id:`edge-${i}`,from:e.from,to:e.to,color:e.type==='reply'?'#a6b8cc':'#b9a4cd',lineWidth:1+Math.min(e.weight/5,2),dashType:e.type==='mention'?1:0,showEndArrow:true,data:{key:edgeKey(e),weight:e.weight}}))}).then(()=>{if(!disposed){highlight(current.current.selected);instance.moveToCenter();instance.zoomToFit();}});
  return ()=>{disposed=true;};
 },[data,edges,instance,layout,highlight,hideIsolated]);
 useEffect(()=>{highlight(selected);},[selected,highlight,path,showWeights,zh]);
 const {t}=localeTools(zh);
 return <><RelationGraph options={options} nodeSlot={nodeSlot} onNodeClick={node=>current.current.onSelect(node.id)} onLineClick={line=>{const edge=current.current.edges.find(e=>edgeKey(e)===line.data?.key);if(edge)current.current.onEdge(edge);}}/><div className="graph-tools"><button aria-label={t('Zoom in','放大')} title={t('Zoom in','放大')} onClick={()=>instance.zoom(15)}>＋</button><button aria-label={t('Zoom out','缩小')} title={t('Zoom out','缩小')} onClick={()=>instance.zoom(-15)}>−</button><button title={t('Fit all visible users','适应所有可见用户')} onClick={()=>{instance.moveToCenter();instance.zoomToFit();}}><Icon name="fit" size={15}/>{t('Fit graph','适应画布')}</button></div></>;
}
