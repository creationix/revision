all: server.js www/main.js www/worker.js

serve: all
	node server.js

server.js: src/**/*.js
	rollup -c rollup.server.config.js

www/main.js: src/**/*.js
	rollup -c rollup.main.config.js

www/worker.js: src/**/*.js
	rollup -c rollup.worker.config.js

clean:
	rm -f server.js www/main.js* www/worker.js*
