import {basePage, display} from '../../lib/page';
import {State, Pet} from '../../lib/types';
import {healthStatus, today} from '../../lib/domain';
Page(basePage({
 data:{greeting:'每一口，都好好照顾',health:[],recent:[]},
 afterRefresh(state:State,pet:Pet|null){
   this.setData({health:pet?state.healthPlans.filter(h=>h.petId===pet.id&&!h.completedAt).map(h=>({...h,status:healthStatus(h)})).filter(h=>h.status.level!=='later').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)):[],
     recent:pet?state.feedings.filter(f=>f.petId===pet.id&&f.date===today()).sort((a,b)=>b.time.localeCompare(a.time)||b.createdAt.localeCompare(a.createdAt)).slice(0,4).map(f=>({...f,caloriesText:display(f.snapshot.calories)})):[]});
 },
 goFeed(){wx.switchTab({url:'/pages/feed/index'});},
 goGrowth(){wx.switchTab({url:'/pages/growth/index'});}
}));
