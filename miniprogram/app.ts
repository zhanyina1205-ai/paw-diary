import { setOnline } from './lib/service';
App({
  onLaunch() {
    wx.getNetworkType({success:r=>setOnline(r.networkType!=='none')});
    wx.onNetworkStatusChange(r=>setOnline(r.isConnected));
  }
});
