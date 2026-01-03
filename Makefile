.PHONY: setup run clean lint

setup:
	python -m venv venv
	.\venv\Scripts\pip install --upgrade pip
	.\venv\Scripts\pip install -r backend\requirements.txt
	if not exist "uploads" mkdir uploads
	if not exist "backend\app\instance" mkdir backend\app\instance
	@echo Setup complete! Run 'make run' to start the dev server.

run:
	@echo Starting Flask development server...
	cd backend && ..\venv\Scripts\python -m flask --app app run --debug --host 0.0.0.0 --port 5000

run-gunicorn:
	@echo Starting Gunicorn server...
	cd backend && ..\venv\Scripts\gunicorn -w 4 -b 127.0.0.1:8000 wsgi:app

lint:
	@echo Running basic Python checks...
	.\venv\Scripts\python -m py_compile backend\app\*.py

clean:
	if exist "venv" rmdir /s /q venv
	if exist "backend\app\instance" rmdir /s /q backend\app\instance
	if exist "uploads" rmdir /s /q uploads
	for /r %%i in (__pycache__) do @if exist "%%i" rmdir /s /q "%%i"
	@echo Cleaned up!
