(() => {
  let lastHeight=0;
  function reportHeight(){
    const height=Math.ceil(document.querySelector('main').getBoundingClientRect().height);
    if(height!==lastHeight){lastHeight=height;window.webkit?.messageHandlers.cameraStudy?.postMessage({height});}
  }
  new ResizeObserver(reportHeight).observe(document.querySelector('main'));
  reportHeight();
})();
