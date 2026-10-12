(() => {
  const ps = [...document.querySelectorAll('[role=tabpanel]')];
  const t = (ps.find(p => p.offsetParent !== null) || ps[1]).innerText;
  return {
    hasAliM: t.includes('علی محمدی'),
    hasAliR: t.includes('علی رضایی'),
    hasReza: t.includes('رضا کریمی'),
    count: (t.match(/[\u06F0-\u06F9]+ نتیجه[^\n]*/) || [null])[0],
    noResult: t.includes('شخصی پیدا نشد'),
    statusLine: (t.match(/الان [^\n]+/) || [null])[0],
  };
})()
