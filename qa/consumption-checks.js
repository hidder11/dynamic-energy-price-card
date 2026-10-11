// Run from docs/examples/consumption.html after exampleReady. All export data
// below is a deliberately duplicated import series for mode regression only.
window.checkConsumption = async function(referenceModule) {
  const c = window.card, savedConfig = {...window.exampleConfig}, savedHass = window.exampleHass;
  const checks = [];
  const assert = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
  const wait = async () => { for (let i=0;i<100;i++) {if(c._consumption?.status!=='loading') return;await new Promise(r=>setTimeout(r,10));}throw Error('Energy request timed out'); };
  const configure = async (config={}, hass=savedHass) => {c.setConfig({...savedConfig,...config});c.hass=hass;await wait();};
  await configure();
  assert(c._consumption.intervalMinutes===15,'actual history uses price quarter-hours');
  assert(c._consumption.points.length===84 && c._consumption.points.filter(p=>Number.isFinite(p.energy)).length===74,'84 complete intervals; 74 valid, 10 rejected transient decreases');
  const priceScale=c._chart.yFor(.25);
  const line=c.shadowRoot.querySelector('.consumption-line');
  assert(getComputedStyle(line).strokeWidth==='1.5px','muted default line is 1.5px');
  assert(!c.shadowRoot.querySelector('.consumption-area'),'fill off by default');
  assert(Math.abs((c._chart.plotRight-12)*c.shadowRoot.querySelector('.chart').clientWidth/1000-32)<.1,'right axis uses only 32px gutter');
  const modes=[];
  for(const language of ['en','nl']) for(const mode of ['import','export','both']) {
    const hass={...savedHass,language,locale:{language},states:{...savedHass.states,'sensor.qa_export':savedHass.states['sensor.tibber_prijzen']}};
    await configure({graph_mode:mode,current_price_mode:mode,export_entity:'sensor.qa_export'},hass);
    for(const i of [0,24,48,72,95]) {
      c._showPoint(i);
      const root=c.shadowRoot,chart=root.querySelector('.chart').getBoundingClientRect(),tip=root.querySelector('.tooltip').getBoundingClientRect();
      assert(tip.left>=chart.left-.5&&tip.right<=chart.right+.5&&tip.top>=chart.top-.5&&tip.bottom<=chart.bottom+.5,`${mode} tooltip ${i} inside chart`);
      for(const dot of root.querySelectorAll('.hover-dot:not([hidden])')) {
        const d=dot.getBoundingClientRect();
        assert(Math.abs(d.width-d.height)<.1,`${mode} marker ${i} round`);
        assert(!(tip.left<d.right&&tip.right>d.left&&tip.top<d.bottom&&tip.bottom>d.top),`${mode} tooltip ${i} avoids marker`);
      }
      assert(root.querySelector('.tooltip').innerText.includes(i===95?(language==='nl'?'Netafname —':'Grid import —'):'kWh'),`${mode} tooltip ${i} honest kWh/future`);
    }
    modes.push(mode);
  }
  await configure({show_hover_line:false});
  const chart=c.shadowRoot.querySelector('.chart');chart.focus();chart.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
  assert(c._activeIndex===0&&!c.shadowRoot.querySelector('.hover-line'),'keyboard and tooltip work without hover guide');
  const rect=chart.getBoundingClientRect();chart.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.left+rect.width*.5,clientY:rect.top+40,pointerType:'touch',bubbles:true}));
  assert(!c.shadowRoot.querySelector('.tooltip').hidden,'touch shows tooltip');
  document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));assert(c.shadowRoot.querySelector('.tooltip').hidden,'outside touch dismisses tooltip');
  for(const style of ['solid','dashed','dotted']) {
    await configure({consumption_line_style:style,consumption_line_width:2,consumption_line_color:[0,0,0],show_consumption_fill:true,consumption_fill_color:[0,0,0],consumption_fill_fade:false});
    const l=c.shadowRoot.querySelector('.consumption-line'),area=c.shadowRoot.querySelector('.consumption-area');
    assert(getComputedStyle(l).stroke==='rgb(0, 0, 0)'&&getComputedStyle(l).strokeWidth==='2px',`${style} custom width/black color`);
    assert(getComputedStyle(l).strokeDasharray===(style==='solid'?'none':style==='dashed'?'8px, 7px':'1px, 7px'),`${style} computed dashes`);
    assert(getComputedStyle(area).fill==='rgb(0, 0, 0)',`${style} independent flat fill`);
    assert(c._chart.yFor(.25)===priceScale,'consumption does not change price scale');
  }
  await configure({show_consumption_fill:true,consumption_fill_fade:true});assert(c.shadowRoot.querySelector('.consumption-area').classList.contains('fade'),'independent fading fill');
  c.shadowRoot.querySelector('[data-series="consumption"].legend-series').click();assert(!c.shadowRoot.querySelector('.consumption-line')&&!c.shadowRoot.querySelector('.energy-axis-label'),'legend hides consumption and axis');
  c.shadowRoot.querySelector('[data-series="consumption"].legend-series').click();assert(c.shadowRoot.querySelector('.consumption-line'),'legend restores consumption');
  await configure({}, {...savedHass,callApi:async()=>[]});
  assert(c._consumption.intervalMinutes===60&&c._consumption.source==='statistics','real hourly fallback is not divided into quarters');
  c._showPoint(1);assert(c.shadowRoot.querySelector('.tooltip').innerText.includes('00:00–01:00'),'hourly tooltip states actual interval');
  await configure({consumption_entity:'sensor.missing'});assert(c._consumption.status==='source','missing source remains nonblocking');
  const callsBefore=window.apiCalls.length+window.statisticsCalls.length;
  await configure({show_consumption:false});
  assert(window.apiCalls.length+window.statisticsCalls.length===callsBefore,'off sends no history/statistics requests');
  assert(!c.shadowRoot.querySelector('.consumption-line')&&!c.shadowRoot.querySelector('.energy-axis-label'),'off removes overlay');
  let baselineChecks=0;
  if(referenceModule) {
    await import(referenceModule);
    const ref=document.createElement('reference-energy-price-card'),main=document.querySelector('main'),b=main.getBoundingClientRect();
    Object.assign(ref.style,{position:'absolute',left:`${b.left}px`,top:`${b.top}px`,width:`${b.width}px`,height:`${b.height}px`,visibility:'hidden'});document.body.append(ref);
    ref.setConfig({...savedConfig,show_consumption:false});ref.hass=savedHass;
    for(const selector of ['.compact-summary','.compact-current','.chart','.price-table-wrap','.favorable-table','.import-line','.level-line','.selection-band','.y-label']) {
      const current=[...c.shadowRoot.querySelectorAll(selector)],previous=[...ref.shadowRoot.querySelectorAll(selector)];assert(current.length===previous.length,`baseline ${selector} count`);
      current.forEach((node,i)=>{const a=node.getBoundingClientRect(),old=previous[i].getBoundingClientRect();assert(['left','top','width','height'].every(k=>Math.abs(a[k]-old[k])<.1),`baseline ${selector} geometry`);assert(['color','backgroundColor','stroke','fill','strokeWidth','opacity'].every(k=>getComputedStyle(node)[k]===getComputedStyle(previous[i])[k]),`baseline ${selector} colors`);if(node.tagName==='path')assert(node.getAttribute('d')===previous[i].getAttribute('d'),`baseline ${selector} path`);baselineChecks++;});
    }
    ref.remove();
  }
  await configure();c._hideTooltip();
  const root=c.shadowRoot,table=root.querySelector('.price-table-wrap');
  assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal page overflow');
  return {width:innerWidth,checks:checks.length,baselineChecks,modes:[...new Set(modes)],languages:['en','nl'],tableOverflow:table.scrollWidth>table.clientWidth,chartWidth:root.querySelector('.chart').clientWidth,actualIntervals:84,validIntervals:74,source:c._consumption.source,cadence:c._consumption.intervalMinutes};
};
