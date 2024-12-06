deploy:
	git commit -am "heroku deploy"
	git push -f heroku HEAD:master

.PHONY: serve dev

PYTHON=$(shell if [ -f env/bin/python ]; then echo env/bin/python; else echo python; fi)

dev:
	$(PYTHON) -c "import sys; print(sys.executable)"
	
serve:
	python -m http.server -b localhost
