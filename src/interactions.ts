import type {InteractionType} from '../server/graph';
export const interactionTypes=['reply','mention','like','dislike'] as const;
export const interactionLabel=(type:InteractionType,zh:boolean)=>({reply:zh?'回复':'Replies',mention:zh?'@提及':'@Mentions',like:zh?'点赞':'Likes',dislike:zh?'点踩':'Downvotes'})[type];
export const interactionColor=(type:InteractionType)=>({reply:'#6c8bb5',mention:'#9a79b9',like:'#3a9564',dislike:'#cc6678'})[type];
