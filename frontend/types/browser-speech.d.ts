export interface BrowserSpeechResultEvent { results:SpeechRecognitionResultList;resultIndex:number }
export interface BrowserSpeechErrorEvent { error:string;message:string }
export interface BrowserSpeechRecognition { continuous:boolean;interimResults:boolean;lang:string;maxAlternatives:number;onresult:((event:BrowserSpeechResultEvent)=>void)|null;onerror:((event:BrowserSpeechErrorEvent)=>void)|null;onend:(()=>void)|null;start():void;stop():void;abort():void }
declare global { interface Window { SpeechRecognition?:new()=>BrowserSpeechRecognition;webkitSpeechRecognition?:new()=>BrowserSpeechRecognition } }
