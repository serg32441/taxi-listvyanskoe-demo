'use strict';
// Browser-only demonstration. No API, credentials, or shared order storage.
{
  const realFetch=window.fetch.bind(window);
  const now=new Date().toISOString();
  const orders=[
    {id:1,type:'taxi',status:'new',from_address:'Лесная, 12',to_address:'Поликлиника',when_text:'Сейчас',passengers:1,phone:'+7 000 000-00-00',comment:'Пример заявки для просмотра',assignee:'',name:'Демо-клиент',created_at:now},
    {id:2,type:'delivery',status:'accepted',items_text:'Молоко 1 л\nХлеб\nЯйца 10 шт.',delivery_address:'Центральная, 8',phone:'+7 000 000-00-00',comment:'Демонстрационные данные',assignee:'Алексей',name:'Демо-клиент',created_at:now}
  ];
  const profile={name:'Демо-клиент',phone:'',last_address:'',is_admin:true};
  const response=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
  window.fetch=(input,options={})=>{
    if(typeof input!=='string'||!input.startsWith('/api/'))return realFetch(input,options);
    const url=new URL(input,location.origin);
    const body=options.body?JSON.parse(options.body):{};
    if(url.pathname==='/api/me')return response(profile);
    if(url.pathname==='/api/orders'&&options.method==='POST'){
      const order={...body,id:Math.max(0,...orders.map(o=>o.id))+1,status:'new',assignee:'',name:profile.name,created_at:new Date().toISOString()};
      orders.push(order);profile.phone=body.phone;if(body.delivery_address)profile.last_address=body.delivery_address;
      return response(order,201);
    }
    if(url.pathname==='/api/orders/my'||url.pathname==='/api/admin/orders'){
      const status=url.searchParams.get('status');return response(orders.filter(o=>!status||o.status===status).slice().reverse());
    }
    const match=url.pathname.match(/^\/api\/(?:admin\/)?orders\/(\d+)\/(cancel|status)$/);
    if(match){
      const order=orders.find(o=>o.id===Number(match[1]));if(!order)return response({detail:'Заявка не найдена'},404);
      order.status=body.status||'canceled';if(body.assignee!==undefined)order.assignee=body.assignee;return response(order);
    }
    return response({detail:'Демонстрационный режим'},404);
  };
}
