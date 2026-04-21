import{z as i}from"./index-E6lM3EpV.js";/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r=i("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.294.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=i("Upload",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"17 8 12 3 7 8",key:"t8dd8p"}],["line",{x1:"12",x2:"12",y1:"3",y2:"15",key:"widbto"}]]),t={bronze:{maxJobValue:1e4,requiresId:!1,escrowSplits:[100]},silver:{maxJobValue:5e4,requiresId:!0,escrowSplits:[50,50]},gold:{maxJobValue:1/0,requiresId:!0,escrowSplits:[25,25,25,25]}};function l(o){const e=(o==null?void 0:o.verificationTier)||"bronze";return{tier:e,config:t[e],canPostJob:a=>a<=t[e].maxJobValue,needsUpgrade:a=>a>t[e].maxJobValue}}export{r as C,t as T,s as U,l as u};
//# sourceMappingURL=useTier-C0g0nj7q.js.map
