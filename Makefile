build:
	ls rollup.*.config.js | xargs -n1 -P4 rollup -c

watch:
	ls rollup.*.config.js | grep -v server | xargs -n1 -P10 rollup -w -c

serve:
	rollup -c rollup.server.config.js
	node server.js
