import type {Edge} from '../server/graph';
import {edgeKey} from './data';
export const GRAPH_RELATIONSHIP_LIMIT=100;
/** Rank within the chosen graph scope; never truncate the collected dataset. */
export function strongestGraphEdges(edges:Edge[]){
 return [...edges].sort((a,b)=>{
  const weight=b.weight-a.weight;if(weight)return weight;
  const left=edgeKey(a),right=edgeKey(b);return left<right?-1:left>right?1:0;
 }).slice(0,GRAPH_RELATIONSHIP_LIMIT);
}
