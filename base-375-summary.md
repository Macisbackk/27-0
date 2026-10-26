## Hydration hunt v2: base-375
Loads: 912 (crawls: 0). Hydration pageerrors: 14

- `home-play in-doc /play (labelled /play)`: 7
- `home-play pageerror labelled /play`: 7
- `play-direct in-doc /play (labelled /play)`: 1
- `play-direct pageerror labelled /play`: 1
- `play-direct in-doc /play?era=1 (labelled /play?era=1)`: 6
- `play-direct pageerror labelled /play?era=1`: 6

### in http://localhost:3000/play (labelled /play, home-play) readyState=interactive sw at 95ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
59ms DOMContentLoaded
63ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
63ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
95ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play (labelled /play, home-play) readyState=interactive sw at 95ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
61ms DOMContentLoaded
65ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
65ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
95ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play (labelled /play, home-play) readyState=interactive sw at 86ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
23ms DOMContentLoaded
42ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
42ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
86ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play (labelled /play, home-play) readyState=interactive sw at 99ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
60ms DOMContentLoaded
64ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
64ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
99ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play (labelled /play, play-direct) readyState=interactive nosw at 316ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
19ms DOMContentLoaded
316ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play?era=1 (labelled /play?era=1, play-direct) readyState=interactive sw at 91ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
37ms DOMContentLoaded
47ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
47ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
91ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play (labelled /play, home-play) readyState=interactive sw at 196ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
60ms DOMContentLoaded
63ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
63ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
196ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
### in http://localhost:3000/play?era=1 (labelled /play?era=1, play-direct) readyState=interactive sw at 91ms
```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
STACK MISMATCH FIBER: main.app-main.flex.min-w-0.max-w-full(tag5)
props keys: className,children
main children value: {$$typeof:Symbol(react.lazy), then:undefined, status:undefined, type:-, payloadStatus:fulfilled}
return chain: Symbol(react.context)(tag10)  <  l(tag0) src{function l(e){let{children:t,isValidProp:n,...l}=e;n&&(0,o.D)(n),(l={...(0,i.useContext)(a.Q),...l}).isStatic=(0,s.M)(()=>l.isStatic);let c=}  <  l(tag0) src{function l(e){let{children:t}=e;return(0,r.jsx)(a.x,{reducedMotion:"user",children:t})}}  <  Symbol(react.context)(tag10)  <  h(tag0) src{function h(e){var t;let{children:n}=e,{loading:m,user:h}=(0,o.A)(),f=null!=(t=null==h?void 0:h.id)?t:null,[p,x]=(0,a.useState)([]),[v,g]=(0,}  <  Symbol(react.context)(tag10)  <  j(tag0) src{function j(e){let{children:t}=e,[r,i]=(0,n.useState)(null),[c,u]=(0,n.useState)(null),[d,f]=(0,n.useState)(!0),h=(0,n.useRef)(0),y=(0,n.useR}  <  body.app-shell.flex.min-h-dvh.min-w-0(tag27)  <  html.__variable_c8e612.__variable_ba43c0.__variable_bd776b(tag27)  <  tag7(tag7)  <  __next_root_layout_boundary__(tag0) src{function(e){let{children:t}=e;return t}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,i.isRedirectError)(e))return{redirect:(0,a.getURLFromRedirectEr}  <  f(tag0) src{function f(e){let{children:t}=e,r=(0,l.useRouter)();return(0,u.jsx)(s,{router:r,children:t})}}  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  Symbol(react.context)(tag10)  <  D(tag0)  <  s(tag1) src{class s extends o.default.Component{static getDerivedStateFromError(e){if((0,a.isNextRouterError)(e))throw e;return{error:e}}static getDeriv}  <  f(tag0) src{function f(e){let{errorComponent:t,errorStyles:r,errorScripts:n,children:o}=e,a=(0,l.useUntrackedPathname)();return t?(0,u.jsx)(s,{pathname:}  <  i(tag0) src{function i(e){let{children:t,errorComponent:r,errorStyles:n,errorScripts:i}=e;return a?(0,u.jsx)(o.default,{children:t}):(0,u.jsx)(l.ErrorBo}  <  L(tag0)  <  A(tag0)  <  x(tag0) src{function x(e){let{children:t}=e;return t}}  <  Symbol(react.context)(tag10)  <  symbol(tag8)  <  tag3(tag3)
siblings: l(tag0) / s(tag0) / U(tag0) / *main.app-main.flex.min-w-0.max-w-full(tag5) / tag16(tag16) / tag16(tag16) / tag16(tag16)
subtree of parent up to mismatch:
l(tag0) flags=9439233 lanes=0
s(tag0) flags=9439233 lanes=0
U(tag0) flags=9439233 lanes=0
  header.app-header.sticky.top-0.z-50(tag5) flags=1048576 lanes=0 dom
    o(tag0) flags=9963521 lanes=0
      div.fl-nav-progress.fl-nav-progress--idle(tag5) flags=0 lanes=0 dom
    div.app-chrome.relative.grid.h-14(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-start(tag5) flags=1048576 lanes=0 dom
        h(tag0) flags=8914945 lanes=0
          div.flex.h-11.items-center.justify-center[aria-label=Loading account](tag5) flags=0 lanes=0 dom
            span.text-[length:var(--text-small)].text-gray-400.leading-snug(tag5) flags=0 lanes=0 dom
      g.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag0) flags=1572865 lanes=0
        Symbol(react.context)(tag10) flags=0 lanes=0
          a.flex.shrink-0.items-center.justify-center[href=/][aria-label=27-0 home](tag5) flags=4194816 lanes=0 dom
            f(tag0) flags=1 lanes=0
              span.logo-mark.inline-flex.items-center.whitespace-nowrap(tag5) flags=0 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__dash(tag5) flags=1048576 lanes=0 dom
                span.logo-mark__cell(tag5) flags=1048576 lanes=0 dom
      div.flex.min-w-0.items-center.justify-end(tag5) flags=1048576 lanes=0 dom
        button.fl-pressable.flex.h-11.w-11[aria-label=Open menu](tag5) flags=0 lanes=0 dom
          svg(tag5) flags=0 lanes=0 dom
            path(tag5) flags=0 lanes=0 dom
  tag13(tag13) flags=1048576 lanes=32 ms=["dehydrated","treeContext","retryLane","hydrationErrors"] DEHYDRATED
    tag18(tag18) flags=0 lanes=0 dom8
main.app-main.flex.min-w-0.max-w-full(tag5) flags=0 lanes=0
root tag 3; alternate? false; React version nohook
host parent: body.app-shell.flex.min-h-dvh.min-w-0(tag27); its DOM children now: div / header.app-header.sticky.top-0 / <!--$!--> / template / <!--/$--> / main.app-main.flex.min-w-0 / footer.site-footer.relative.mt-auto / div#game-portal-root / script#_R_ / script / script / script / script / script / script
22ms DOMContentLoaded
43ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-ui-theme +[] -[]
43ms attributes html.__variable_c8e612.__variable_ba43c0.__variable_bd776b @data-theme-logo-glow +[] -[]
91ms ERROR Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
```
