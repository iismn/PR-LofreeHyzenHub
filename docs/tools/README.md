# README preview

`build-readme-images.py` creates a cover from real read-only app captures, then adds a small positional animation to those screenshots. It does not synthesize keyboard settings or simulate device writes.

The source screenshots come from `LofreeHUB.exe --verify <capture-folder>`. The output uses the same keyboard and actuation screens as the application. Requirements: Python 3 and Pillow.

```powershell
python docs/tools/build-readme-images.py .build/capture
```

The script also exports connection, mapping, actuation and lighting screenshots for the README. The preview assets are documentation; they are not loaded by the app.
