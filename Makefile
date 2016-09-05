watch:
	ls rollup.*.config.js | grep -v server | xargs -n1 -P10 rollup -w -c

serve:
	rollup -c rollup.server.config.js
	node server.js
