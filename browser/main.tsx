import React from 'react';
import {render} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {html_favicon_set, html_stylesheet_add} from 'lif-kernel/util';
import './node_env.js';
let App = (await import('./app.jsx')).default;
html_favicon_set(import.meta.resolve('./lif_node.png'));
html_stylesheet_add(import.meta.resolve('./style.css'));
// start app
let _root = document.body.appendChild(document.createElement('div'));
let root = createRoot(_root);
root.render(<App />);
