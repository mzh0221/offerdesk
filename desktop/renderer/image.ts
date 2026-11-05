const image = document.getElementById('image') as HTMLImageElement;
const error = document.getElementById('error')!;
image.onerror = () => { image.hidden = true; error.hidden = false; };
const source = decodeURIComponent(location.hash.slice(1));
if (source.startsWith('blob:offerdesk://app/')) image.src = source;
else { image.hidden = true; error.hidden = false; }
