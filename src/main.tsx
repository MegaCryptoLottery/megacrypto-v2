import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import './web3/appkit'; import App from './App'; import './styles.css'; import './asset-styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);

