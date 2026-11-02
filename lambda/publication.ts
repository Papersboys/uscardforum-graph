export function publicCategoryIds(data:unknown):Set<number>{
 const ids=new Set<number>();
 const visit=(categories:any[],ancestorsPublic:boolean)=>{for(const category of categories){const isPublic=ancestorsPublic&&category.read_restricted===false;if(isPublic&&Number.isSafeInteger(category.id))ids.add(category.id);if(Array.isArray(category.subcategory_list))visit(category.subcategory_list,isPublic);}};
 const categories=(data as any)?.category_list?.categories;
 if(!Array.isArray(categories))throw Error('Invalid category visibility response');visit(categories,true);if(!ids.size)throw Error('No verified public categories');return ids;
}
