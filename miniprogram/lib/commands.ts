import { State, Command, Pet, Food, Recipe, Feeding, Diary, HealthPlan } from './types';
import { today, validDate, foodDensity, recipeEnergy, recipeGrams, recipeEligible, addDays } from './domain';

export class DomainError extends Error { constructor(message: string) { super(message); this.name = 'DomainError'; } }
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new DomainError(message); }
function text(value: any, label: string, required = false, limit = 200): string {
  assert(typeof value === 'string', `${label}格式不正确`);
  const result = value.trim(); assert(result.length <= limit && (!required || result.length > 0), `请填写有效的${label}`); return result;
}
function num(value: any, label: string, min: number, max: number, nullable = false): number | null {
  if (nullable && (value === '' || value === undefined || value === null)) return null;
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${label}应在${min}至${max}之间`); return value;
}
function integer(value: any, label: string, min: number, max: number): number { const n = num(value, label, min, max) as number; assert(Number.isInteger(n), `${label}需要整数`); return n; }
function date(value: any, label: string, past = false): string { assert(typeof value === 'string' && validDate(value), `${label}无效`); assert(!past || value <= today(), `${label}不能在未来`); return value; }
function id(value: any): string { assert(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value), '记录标识无效'); return value; }
function photos(value: any): string[] {
  assert(Array.isArray(value) && value.length <= 9 && value.every(v => typeof v === 'string' && v.length <= 1000), '最多上传9个附件'); return value;
}
function pet(state: State, petId: string): Pet { const p = state.pets.find(p => p.id === petId && !p.archived); assert(p, '请选择家庭内的有效狗狗'); return p; }
function upsert<T extends {id: string}>(items: T[], value: T) { const i = items.findIndex(x => x.id === value.id); if (i < 0) items.push(value); else items[i] = value; }
const listKeys = { pet: 'pets', weight: 'weights', food: 'foods', recipe: 'recipes', diary: 'diaries', health: 'healthPlans', feeding: 'feedings' } as const;

export function applyCommand(original: State, command: Command, actorId: string, now = new Date()): State {
  const state: State = JSON.parse(JSON.stringify(original));
  const actor = state.family.members.find(m => m.id === actorId); assert(actor, '你已不在该家庭中');
  const familyId = state.family.id, createdAt = now.toISOString();
  if (command.type === 'rename') { actor.name = text(command.name, '昵称', true, 30); }
  else if (command.type === 'removeMember') {
    assert(actor.admin, '只有家庭管理员能移除成员'); assert(command.id !== actor.id, '管理员不能移除自己');
    assert(state.family.members.some(m => m.id === command.id), '成员不存在');
    state.family.members = state.family.members.filter(m => m.id !== command.id);
  } else if (command.type === 'delete') {
    assert(command.entity in listKeys, '记录类型无效');
    const items = state[listKeys[command.entity]] as {id: string}[];
    assert(items.some(x => x.id === command.id), '记录不存在');
    if (command.entity === 'pet') { pet(state, command.id).archived = true; }
    else {
      if (command.entity === 'food') assert(!state.pets.some(p => !p.archived && p.mainFoodId === command.id), '该食物正在用于喂养计划，请先更换主粮');
      if (command.entity === 'recipe') assert(!state.pets.some(p => !p.archived && p.mainRecipeId === command.id), '该食谱正在用于喂养计划，请先更换食谱');
      const index = items.findIndex(x => x.id === command.id); items.splice(index, 1);
      if (command.entity === 'diary') state.weights = state.weights.filter(w => w.id !== `diary_${command.id}`);
    }
  } else if (command.type === 'feed') {
    const requestId = id(command.requestId), logId = id(command.id);
    const existing = state.feedings.find(f => f.requestId === requestId || f.id === logId);
    if (existing) {
      assert(existing.actorId === actorId && existing.petId === command.petId && existing.amount === command.amount && existing.date === command.date && existing.time === command.time && existing.itemId === command.itemId && existing.itemType === command.itemType, '该请求已保存，请刷新记录后再添加新的进食');
      return state;
    }
    const p = pet(state, command.petId);
    const amount = num(command.amount, '进食数量', .001, 100000) as number;
    const recordDate = date(command.date, '进食日期', true);
    assert(recordDate >= p.birthday, '进食日期不能早于生日');
    assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(command.time), '进食时间无效');
    let snapshot: Feeding['snapshot'];
    if (command.itemType === 'food') {
      const f = state.foods.find(f => f.id === command.itemId); assert(f, '食物已被移除，请重新选择');
      const density = foodDensity(f);
      snapshot = { name: f.name, unit: f.unit === 'kcalpiece' ? '个' : 'g', calories: density == null ? null : density * amount,
        role: f.role === 'main' && !f.complete ? 'addon' : f.role };
    } else {
      assert(command.itemType === 'recipe', '食物类型无效');
      const r = state.recipes.find(r => r.id === command.itemId); assert(r, '食谱已被移除，请重新选择');
      const energy = recipeEnergy(r);
      snapshot = { name: r.name, unit: 'g', calories: energy == null ? null : energy / recipeGrams(r) * amount,
        role: recipeEligible(r, p) ? 'main' : 'addon', recipeVersion: r.version };
    }
    state.feedings.push({ id: logId, familyId, petId: p.id, date: recordDate, time: command.time, itemType: command.itemType,
      itemId: command.itemId, amount, snapshot, actorId, actorName: actor.name, createdAt, requestId });
  } else if (command.type === 'completeHealth') {
    const plan = state.healthPlans.find(h => h.id === command.id); assert(plan, '计划不存在');
    if (plan.completedAt) return state;
    const completion = date(command.date, '完成日期', true); assert(completion >= pet(state, plan.petId).birthday, '完成日期不能早于生日');
    plan.completedAt = completion; plan.revision++;
    if (plan.repeatDays) {
      let suffix=plan.revision,nextId=`${plan.id.slice(0,55)}_next_${suffix}`;
      while(state.healthPlans.some(h=>h.id===nextId)){suffix++;nextId=`${plan.id.slice(0,55)}_next_${suffix}`;}
      const next: HealthPlan = { ...plan, id: nextId, recordDate: completion,
        dueDate: addDays(completion, plan.repeatDays), completedAt: null, previousId: plan.id, revision: 1 };
      state.healthPlans.push(next);
    }
  } else if (command.type === 'save') {
    const v = command.value; assert(v && typeof v === 'object' && !Array.isArray(v), '记录无效');
    const recordId = id(v.id);
    if (command.entity === 'pet') {
      const stage = v.stage; assert(stage === 'puppy' || stage === 'adult', '请选择成长阶段');
      const birthday = date(v.birthday, '生日', true);
      const p: Pet = { id: recordId, familyId, name: text(v.name, '名字', true, 30), birthday, breed: text(v.breed, '品种', false, 60),
        stage, neutered: !!v.neutered, weaned: !!v.weaned, bodyCondition: integer(v.bodyCondition, '体况评分', 1, 9),
        meals: integer(v.meals, '每日餐数', 1, 8), vetTarget: num(v.vetTarget, '兽医热量目标', 1, 20000, true),
        freshPercent: num(v.freshPercent, '鲜食比例', 0, 100) as number, snackPercent: num(v.snackPercent, '预留加餐比例', 0, 10) as number,
        mainFoodId: text(v.mainFoodId || '', '主粮'), mainRecipeId: text(v.mainRecipeId || '', '食谱') };
      if (p.mainFoodId) assert(state.foods.some(f => f.id === p.mainFoodId && f.complete && f.unit !== 'kcalpiece'), '请选择完整主粮（以克计量）');
      if (p.mainRecipeId) assert(state.recipes.some(r => r.id === p.mainRecipeId), '食谱不存在');
      upsert(state.pets, p);
      if (v.initialWeight !== '' && v.initialWeight != null) {
        const weightDate = date(v.weightDate, '称重日期', true); assert(weightDate >= birthday, '称重日期不能早于生日');
        const kg = num(v.initialWeight, '体重kg', .05, 150) as number;
        upsert(state.weights, { id: `profile_${p.id}_${weightDate}`, familyId, petId: p.id, date: weightDate, kg, updatedAt: createdAt });
      }
    } else if (command.entity === 'weight') {
      const p = pet(state, v.petId), d = date(v.date, '称重日期', true); assert(d >= p.birthday, '称重日期不能早于生日');
      upsert(state.weights, { id: recordId, familyId, petId: p.id, date: d, kg: num(v.kg, '体重kg', .05, 150) as number, updatedAt: createdAt });
    } else if (command.entity === 'food') {
      assert(['kcal100g', 'kcalkg', 'kcalpiece'].includes(v.unit), '热量单位无效');
      assert(['main','treat','addon'].includes(v.role), '食物用途无效');
      const f: Food = { id: recordId, familyId, name: text(v.name, '食物名称', true, 80), unit: v.unit,
        energy: num(v.energy, '食物热量（请核对单位）', 0, v.unit === 'kcal100g' ? 1000 : 10000, true), complete: !!v.complete, role: v.role };
      upsert(state.foods, f);
    } else if (command.entity === 'recipe') {
      assert(['main','addon'].includes(v.purpose) && ['raw','cooked'].includes(v.basis), '食谱用途或称重方式无效');
      assert(Array.isArray(v.stages) && v.stages.length > 0 && v.stages.every((s: string) => s === 'puppy' || s === 'adult'), '请选择适用成长阶段');
      assert(Array.isArray(v.ingredients) && v.ingredients.length > 0 && v.ingredients.length <= 40, '请录入1至40种食材');
      assert(Array.isArray(v.supplements) && v.supplements.length <= 20, '补充剂数量过多');
      const old = state.recipes.find(r => r.id === recordId);
      const r: Recipe = { id: recordId, familyId, name: text(v.name, '食谱名称', true, 80), purpose: v.purpose,
        source: text(v.source, '专业食谱来源', false, 400), stages: [...new Set(v.stages)] as Recipe['stages'], basis: v.basis,
        batchEnergy: num(v.batchEnergy, '整份食谱热量', .01, 100000, true),
        ingredients: v.ingredients.map((i: any) => ({ name: text(i.name, '食材名', true, 60), grams: num(i.grams, '食材克数', .001, 100000) as number, energy: num(i.energy, '食材热量', 0, 1000, true) })),
        supplements: v.supplements.map((s: any) => ({ name: text(s.name, '补充剂名称', true, 80), amount: num(s.amount, '补充剂用量', .000001, 100000) as number, unit: text(s.unit, '补充剂单位', true, 10) })),
        verified: v.purpose === 'main' && !!v.verified, version: (old?.version || 0) + 1 };
      const changed = old && JSON.stringify([old.ingredients, old.supplements, old.basis, old.batchEnergy, old.stages, old.source]) !== JSON.stringify([r.ingredients, r.supplements, r.basis, r.batchEnergy, r.stages, r.source]);
      if (changed && !v.reconfirm) r.verified = false;
      if (r.verified) assert(!!r.source && r.purpose === 'main' && recipeEnergy(r) != null, '完整主食需来源、整份热量及专业审核确认');
      upsert(state.recipes, r);
    } else if (command.entity === 'diary') {
      const p = pet(state, v.petId), d = date(v.date, '日记日期', true); assert(d >= p.birthday, '日记日期不能早于生日');
      const entry: Diary = { id: recordId, familyId, petId: p.id, date: d, text: text(v.text || '', '日记', false, 4000), photos: photos(v.photos),
        weight: num(v.weight, '体重kg', .05, 150, true), stool: text(v.stool || '', '便便状态', false, 30), color: text(v.color || '', '便便颜色', false, 30),
        abnormal: text(v.abnormal || '', '异常备注', false, 500), actorName: actor.name };
      assert(entry.text || entry.photos.length || entry.weight || entry.stool || entry.abnormal, '请至少记录一项成长信息');
      upsert(state.diaries, entry);
      state.weights = state.weights.filter(w => w.id !== `diary_${recordId}`);
      if (entry.weight) state.weights.push({ id: `diary_${recordId}`, familyId, petId: p.id, date: d, kg: entry.weight, updatedAt: createdAt });
    } else if (command.entity === 'health') {
      const p = pet(state, v.petId);
      assert(['vaccine','internal','external','checkup'].includes(v.kind), '健康事项类型无效');
      const old = state.healthPlans.find(h => h.id === recordId);
      const recordDate = v.recordDate ? date(v.recordDate, '上次完成日期', true) : '';
      const dueDate = date(v.dueDate, '下次日期');
      assert(dueDate >= p.birthday && (!recordDate || (recordDate >= p.birthday && dueDate >= recordDate)), '下次日期应不早于生日和上次完成日期');
      const repeatDays = num(v.repeatDays, '重复周期天数', 1, 3650, true); assert(repeatDays == null || Number.isInteger(repeatDays), '周期需要整数天');
      assert(v.kind !== 'vaccine' || repeatDays == null, '疫苗请逐针录入医院计划');
      const h: HealthPlan = { id: recordId, familyId, petId: p.id, kind: v.kind, name: text(v.name, '事项名称', true, 80), recordDate, dueDate,
        dose: text(v.dose || '', '针次', false, 30), hospital: text(v.hospital || '', '医院', false, 120), product: text(v.product || '', '产品', false, 120),
        notes: text(v.notes || '', '备注', false, 1000), attachments: photos(v.attachments || []), repeatDays,
        advanceDays: integer(v.advanceDays, '提前提醒天数', 0, 365), completedAt: old?.completedAt || null, revision: (old?.revision || 0) + 1,
        ...(old?.previousId ? {previousId:old.previousId} : {}) };
      upsert(state.healthPlans, h);
    } else throw new DomainError('记录类型无效');
  } else throw new DomainError('操作无效');
  state.family.version++;
  state.currentUser = { ...actor };
  return state;
}
