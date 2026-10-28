'use strict';
const $ = id => document.getElementById(id);
const bridge = window.WebApp;
const labels = {new:'Новая',accepted:'Принята',in_progress:'В работе',done:'Выполнена',canceled:'Отменена'};
let profile, view = 'home', kind = 'taxi', timer, loading = false, generation = 0;
const assigneeDrafts = new Map();
function notice(message = '', error = false) { $('notice').textContent = message; $('notice').classList.toggle('error',error); }
async function api(path, body) {
  const response = await fetch('/api' + path, {method:body ? 'POST':'GET',headers:{'X-Init-Data':bridge?.initData || '',...(body ? {'Content-Type':'application/json'}:{})},...(body ? {body:JSON.stringify(body)}:{})});
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Не удалось выполнить запрос. Попробуйте ещё раз.');
  return result;
}
function element(tag, text, cls) { const node = document.createElement(tag); if(text !== undefined) node.textContent = text; if(cls) node.className=cls; return node; }
function show(target) {
  if (target === 'admin' && !profile?.is_admin) { notice('Раздел доступен только диспетчеру.',true); return; }
  generation++; clearInterval(timer); view = target; notice();
  ['home','form-view','success','list-view'].forEach(id => $(id).hidden = true);
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === target));
  if (target === 'taxi' || target === 'delivery') {
    kind=target; $('form-view').hidden=false; $('form-title').textContent=kind==='taxi'?'Вызвать такси':'Доставка продуктов';
    $('taxi-fields').hidden=kind!=='taxi'; $('delivery-fields').hidden=kind!=='delivery';
    ['from_address','to_address','items_text','delivery_address'].forEach(name => { const input=$('order-form').elements[name]; input.required=kind==='taxi'?['from_address','to_address'].includes(name):['items_text','delivery_address'].includes(name); input.disabled=!input.required; });
  } else if (target === 'my' || target === 'admin') {
    $('list-view').hidden=false; $('list-title').textContent=target==='admin'?'Заявки посёлка':'Мои заявки'; $('filter-label').hidden=target!=='admin';
    $('orders').replaceChildren(); loadOrders(); timer=setInterval(()=>{ if(!document.querySelector('.order-card input:focus')) loadOrders(); },15000);
  } else $(target).hidden=false;
  window.scrollTo(0,0);
}
async function action(button, task) {
  button.disabled=true; notice();
  try { await task(); } catch(error) { notice(error.message || 'Проверьте соединение и попробуйте ещё раз.',true); } finally { button.disabled=false; }
}
async function loadOrders() {
  if(loading) return; loading=true; const ticket=generation; const admin=view==='admin';
  try {
    const orders=await api(admin?'/admin/orders'+($('filter').value?'?status='+$('filter').value:''):'/orders/my');
    if(ticket!==generation) return;
    const fragment=document.createDocumentFragment();
    if(!orders.length) fragment.append(element('p',admin?'Заявок с таким статусом пока нет.':'Здесь появятся ваши заявки.'));
    for(const order of orders) {
      const card=element('article',undefined,'order-card'); const head=element('div',undefined,'order-head');
      head.append(element('strong',`№${order.id} · ${order.type==='taxi'?'Такси':'Доставка'}`),element('span',labels[order.status],'badge')); card.append(head);
      card.append(element('small',new Date(order.created_at).toLocaleString('ru-RU')));
      card.append(element('h2',order.type==='taxi'?`${order.from_address} → ${order.to_address}`:order.delivery_address));
      card.append(element('p',order.type==='taxi'?`Когда: ${order.when_text}\nПассажиров: ${order.passengers}`:`Купить: ${order.items_text}\nОплата: наличными при получении`));
      if(order.comment) card.append(element('p','Комментарий: '+order.comment));
      if(order.assignee) card.append(element('p','Исполнитель: '+order.assignee));
      if(admin) {
        card.append(element('p','Клиент: '+order.name)); const phone=element('a',order.phone); phone.href='tel:'+order.phone.replace(/[^+\d]/g,''); card.append(phone);
        if(['new','accepted','in_progress'].includes(order.status)) {
          const label=element('label','Исполнитель'); const input=element('input'); input.maxLength=100; input.value=assigneeDrafts.get(order.id) ?? order.assignee; input.oninput=()=>assigneeDrafts.set(order.id,input.value); label.append(input); card.append(label);
          const next={new:['accepted','Принять'],accepted:['in_progress','В пути / выполняется'],in_progress:['done','Выполнена']}[order.status];
          for(const [status,text] of [next,['canceled','Отменить']]) {const button=element('button',text,status!=='canceled'?'next':'');button.onclick=()=>action(button,async()=>{await api(`/admin/orders/${order.id}/status`,{status,expected_status:order.status,assignee:input.value});await loadOrders();});card.append(button);}
        }
      } else if(order.status==='new') { const button=element('button','Отменить заявку');button.onclick=()=>action(button,async()=>{await api(`/orders/${order.id}/cancel`,{});await loadOrders();});card.append(button); }
      fragment.append(card);
    }
    $('orders').replaceChildren(fragment); $('refresh-info').textContent='Обновлено '+new Date().toLocaleTimeString('ru-RU')+' · автообновление каждые 15 секунд';
  } catch(error) { if(ticket===generation) notice(error.message,true); } finally { loading=false; }
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>show(button.dataset.view));
$('when-mode').onchange=()=>{ const later=$('when-mode').value==='later';$('time-label').hidden=!later;$('when-time').required=later; };
$('filter').onchange=()=>loadOrders(); $('refresh').onclick=()=>loadOrders();
$('phone-from-max').onclick=()=>action($('phone-from-max'),async()=>{
  if(!bridge?.requestContact) throw new Error('Введите телефон вручную.');
  try { const contact=await bridge.requestContact();$('order-form').elements.phone.value=contact.phone; } catch {throw new Error('Телефон не получен. Введите его вручную.');}
});
$('order-form').onsubmit=event=>{
  event.preventDefault(); const button=$('submit-order'); if(button.disabled)return;
  action(button,async()=>{
    const data=Object.fromEntries(new FormData(event.target));data.type=kind;data.passengers=Number(data.passengers);
    if(kind==='taxi') {
      if($('when-mode').value==='later') {
        const date=new Date($('when-time').value); if(!Number.isFinite(date.getTime()) || date<=new Date()) throw new Error('Выберите время в будущем.');
        data.when_text=date.toLocaleString('ru-RU')+' (UTC'+(-date.getTimezoneOffset()/60>=0?'+':'')+(-date.getTimezoneOffset()/60)+')';
      } else data.when_text='Сейчас';
    }
    await api('/orders',data); profile.phone=data.phone;if(kind==='delivery')profile.last_address=data.delivery_address;
    event.target.reset();event.target.elements.phone.value=profile.phone;event.target.elements.delivery_address.value=profile.last_address;$('time-label').hidden=true;$('when-time').required=false;show('success');
  });
};
(async()=>{
  try {
    profile=await api('/me');$('navigation').hidden=false;$('admin-link').hidden=!profile.is_admin;
    $('order-form').elements.phone.value=profile.phone;$('order-form').elements.delivery_address.value=profile.last_address;
    const wantsAdmin=location.pathname==='/admin'||bridge?.initDataUnsafe?.start_param==='admin';
    show(wantsAdmin && profile.is_admin?'admin':'home');
    if(wantsAdmin && !profile.is_admin) notice('Раздел доступен только диспетчеру.',true);
  } catch(error) { notice(error.message || 'Не удалось подключиться. Откройте приложение из MAX.',true); }
})();
