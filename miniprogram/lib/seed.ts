import { State } from './types';
import { today, addDays, addMonths, clockTime } from './domain';

export function emptyState(familyId: string, actorId: string, name = '我'): State {
  const member = { id: actorId, name, admin: true };
  return { schemaVersion: 1, family: { id: familyId, name: '我们的毛孩子', version: 0, members: [member] }, currentUser: member,
    pets: [], weights: [], foods: [], recipes: [], feedings: [], diaries: [], healthPlans: [] };
}
export function demoState(): State {
  const s = emptyState('demo_family', 'demo_me', '我'), d = today();
  s.family.members.push({ id: 'demo_family_member', name: '家人', admin: false });
  s.pets = [
    { id: 'pet_mochi', familyId: s.family.id, name: '糯米', birthday: addMonths(d, -3), breed: '比熊', stage: 'puppy', neutered: false, weaned: true,
      bodyCondition: 5, meals: 3, vetTarget: null, freshPercent: 0, snackPercent: 5, mainFoodId: 'food_puppy', mainRecipeId: '' },
    { id: 'pet_cookie', familyId: s.family.id, name: '曲奇', birthday: addMonths(d, -25), breed: '柯基', stage: 'adult', neutered: true, weaned: true,
      bodyCondition: 5, meals: 2, vetTarget: null, freshPercent: 0, snackPercent: 5, mainFoodId: 'food_adult', mainRecipeId: '' }
  ];
  s.foods = [
    { id: 'food_puppy', familyId: s.family.id, name: '幼犬完整主粮（示例）', unit: 'kcal100g', energy: 380, complete: true, role: 'main' },
    { id: 'food_adult', familyId: s.family.id, name: '成犬完整主粮（示例）', unit: 'kcalkg', energy: 3500, complete: true, role: 'main' },
    { id: 'food_treat', familyId: s.family.id, name: '训练小饼干（示例）', unit: 'kcalpiece', energy: 3, complete: false, role: 'treat' }
  ];
  s.weights = Array.from({length:5}, (_, i) => ({ id: `weight_demo_${i}`, familyId: s.family.id, petId: 'pet_mochi', date: addDays(d, -28 + i * 7), kg: 2 + i * .2 }));
  s.weights.push({ id: 'weight_cookie', familyId: s.family.id, petId: 'pet_cookie', date: d, kg: 10.5 });
  s.feedings.push({ id: 'feeding_demo', familyId: s.family.id, petId: 'pet_mochi', date: d, time: clockTime(), itemType: 'food', itemId: 'food_puppy', amount: 25,
    snapshot: { name: s.foods[0].name, unit:'g', calories:95, role:'main' }, actorId: 'demo_family_member', actorName:'家人', createdAt: new Date().toISOString(), requestId: 'demo_feed_request' });
  s.diaries.push({ id: 'diary_demo', familyId: s.family.id, petId: 'pet_mochi', date: addDays(d,-1), text: '第一次学会坐下！散步时又认识了一位新朋友。', photos: [], weight: null, stool:'成形适中', color:'棕色', abnormal:'', actorName:'我' });
  s.healthPlans.push({ id:'health_demo', familyId:s.family.id, petId:'pet_mochi', kind:'vaccine', name:'疫苗下一针（示例）', recordDate:addDays(d,-14), dueDate:addDays(d,3), dose:'第3针', hospital:'请替换为医院计划', product:'', notes:'此日期仅用于演示，实际按医院安排。', attachments:[], repeatDays:null, advanceDays:7, completedAt:null, revision:1 });
  return s;
}
