# QFS Deploy Kit (Assets + 3D)

Pakiet assetow do modułu `GOTOWI DO WDROŻENIA?`.

## Zawartość
- `models/chest_closed.obj` - skrzynia zamknięta
- `models/chest_open.obj` - skrzynia otwarta
- `models/key.obj` - klucz do przeciągania
- `models/scroll.obj` - list po otwarciu
- `models/lock.obj` - zamek
- `models/deploy_assets.mtl` - materiały
- `textures/*.svg` - tekstury stylizowane pod klimat QFS
- `manifest.json` - konfiguracja pozycji/rotacji startowych

## Szybkie użycie (Three.js)
1. Załaduj modele przez `OBJLoader`.
2. Ustaw pozycje bazowe z `manifest.json`.
3. Podmieniaj model skrzyni:
- przed sukcesem: `chest_closed.obj`
- po trafieniu kluczem: `chest_open.obj`
4. Po otwarciu uruchom animację `scroll.obj` (wysunięcie + rozwinięcie).

## Pipeline finalny
- Na końcu produkcji przekonwertuj modele do GLB.
- Dodaj uproszczone kolizje (box collider) dla klucza i zamka.
- Ustal atlas tekstur, jeśli chcesz obniżyć koszt renderingu.
