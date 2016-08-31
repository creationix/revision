FILES = $(wildcard src/**/*.js) $(wildcard src/*.js)

all: server.js www/main.js www/worker.js

serve: all
	node server.js

server.js: $(FILES)
	echo "Recompiling server"
	rollup -c rollup.server.config.js

www/main.js: $(FILES)
	echo "Recompiling main"
	rollup -c rollup.main.config.js

www/worker.js: $(FILES)
	echo "Recompiling worker"
	rollup -c rollup.worker.config.js

clean:
	rm -f server.js www/main.js* www/worker.js*
