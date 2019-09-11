include config.mk

HOMEDIR = $(shell pwd)
BROWSERIFY = ./node_modules/.bin/browserify
UGLIFY = ./node_modules/uglify-es/bin/uglifyjs
TRANSFORM_SWITCH = -t [ babelify --presets [ es2015 ] ]

test:
	node tests/basictests.js

prettier:
	prettier --single-quote --write "**/*.js"

pushall: sync
	git push origin master && npm publish

run:
	wzrd demo-app.js:demo.js -- \
		-d \
		$(TRANSFORM_SWITCH)

build:
	$(BROWSERIFY) $(TRANSFORM_SWITCH) demo-app.js | $(UGLIFY) -c -m -o demo.js

sync:
	scp $(HOMEDIR)/index.html $(USER)@$(SERVER):/$(APPDIR)/
	scp $(HOMEDIR)/demo.js $(USER)@$(SERVER):/$(APPDIR)/
	scp $(HOMEDIR)/app.css $(USER)@$(SERVER):/$(APPDIR)/

set-up-dir:
	ssh $(USER)@$(SERVER) "mkdir -p $(APPDIR)/audio"

