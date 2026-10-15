# Flowchart Generator — ГОСТ 19.701-90 (csharp-gost-flowchart)

<p align="center">
  <img src="https://img.shields.io/badge/Languages-C%23%20%7C%20Python%20%7C%20C%2B%2B%20%7C%20C%20%7C%20Go-blueviolet?style=for-the-badge" alt="Multi-Language">
  <img src="https://img.shields.io/badge/Standard-ГОСТ%2019.701--90-blue?style=for-the-badge" alt="ГОСТ 19.701-90">
  <img src="https://img.shields.io/badge/Theme-Dark%20%26%20Light%20Mode-darkblue?style=for-the-badge" alt="Dark and Light Theme">
  <img src="https://img.shields.io/badge/Export-SVG%20%7C%20PNG%20%7C%20VSDX-success?style=for-the-badge" alt="Export Formats">
  <img src="https://img.shields.io/badge/License-MIT-orange?style=for-the-badge" alt="MIT License">
  <img src="https://img.shields.io/badge/Status-100%25%20Offline%20%26%20Free-brightgreen?style=for-the-badge" alt="Offline Free">
</p>

---

## 📌 О проекте

**csharp-gost-flowchart** — профессиональный автономный комплекс для автоматического построения блок-схем алгоритмов по исходному коду программ со строгим соблюдением требований **ГОСТ 19.701-90 (ЕСПД / ИСО 5807-85)**.

Проект создан на основе реверс-инжиниринга сервиса [blok-shema.ru](https://blok-shema.ru/), но полностью устраняет все его ограничения:
- **100% бесплатно и безлимитно**: никаких оплат, кредитов, подписок и авторизаций.
- **Полная автономность**: работает локально в браузере и консоли без подключения к интернету.
- **Мультиязычность**: поддержка **5 популярных языков программирования**:
  - **C#** (C# 13 / .NET): классы, методы, функции, top-level statements, `Console.ReadLine/WriteLine`, `for`, `while`, `do-while`, `foreach`, `if/else`, тернарные операторы;
  - **Python** (Python 3): `input()`, `print()`, отступы, `if/elif/else`, `while`, `for ... in range(...)` с преобразованием в блок «Подготовка» (`i от a до b`);
  - **C++** (ISO C++): `cin`, `cout`, `getline`, стандартные управляющие конструкции;
  - **C** (ANSI C / C99): `scanf`, `printf`, функции, условия, циклы;
  - **Go** (Golang): автоматическая расстановка точек с запятой (ASI), `var a, b int`, `:=`, `fmt.Scan`, `fmt.Println`, условия `if` без скобок, циклы `for`.
- **Тёмная и светлая темы (Dark / Light Mode)**: стильное переключение темы оформления с сохранением в `localStorage` и поддержкой чертёжной темы ГОСТ.
- **Встроенный интерактивный редактор**: ручное перемещение блоков (drag & drop), привязка к направляющим, координатная сетка, добавление/удаление блоков, история Undo/Redo.
- **Экспорт в 3 формата**:
  - Векторный **SVG** (чистый XML без водяных знаков);
  - Растровый **PNG** ультра-высокого разрешения ($2.5\times$ Retina) для вставки в курсовые, дипломные и лабораторные работы (Word / LibreOffice);
  - Нативный **Microsoft Visio (.VSDX)** для редактирования в десктопном Microsoft Visio.

---

## 📥 Скачать готовые ZIP-архивы (Releases)

Вы можете просто скачать готовый архив и запускать проект без клонирования через Git:

| Версия / ОС | Ссылка на скачивание | Содержимое |
|---|---|---|
| 🪟 **Windows** | [⬇️ csharp-gost-flowchart-windows-v1.0.0.zip](https://github.com/kukes-misis/csharp-gost-flowchart/releases/download/v1.0.0/csharp-gost-flowchart-windows-v1.0.0.zip) | Ярлыки `start-windows.bat`, `open-offline-windows.bat`, веб-приложение, стили, скрипты |
| 🍎 **macOS** | [⬇️ csharp-gost-flowchart-macos-v1.0.0.zip](https://github.com/kukes-misis/csharp-gost-flowchart/releases/download/v1.0.0/csharp-gost-flowchart-macos-v1.0.0.zip) | Ярлыки `start-macos.command`, `open-offline-macos.command`, веб-приложение, стили, скрипты |
| 🌐 **Универсальная (Portable)** | [⬇️ csharp-gost-flowchart-portable-all-v1.0.0.zip](https://github.com/kukes-misis/csharp-gost-flowchart/releases/download/v1.0.0/csharp-gost-flowchart-portable-all-v1.0.0.zip) | Все платформы, тесты, консольный CLI `cli.js`, сервер `server.js` |

*Все релизы и исходные файлы доступны на странице: [GitHub Releases v1.0.0](https://github.com/kukes-misis/csharp-gost-flowchart/releases/tag/v1.0.0)*.

---

## 🚀 Быстрый запуск

### 🪟 Запуск на Windows
В корне репозитория подготовлены удобные ярлыки для запуска в один клик:

1. **`start-windows.bat`** (Двойной клик) — автоматически проверит наличие Node.js:
   - Если Node.js установлен — поднимет локальный сервер и откроет интерфейс в браузере (`http://localhost:8080`).
   - Если Node.js не установлен — мгновенно откроет автономную версию в браузере.
2. **`open-offline-windows.bat`** (Двойной клик) — прямое открытие `index.html` в браузере без запуска терминалов и серверов.

---

### 🍎 Запуск на macOS
В корне репозитория и на Рабочем столе:

1. **`start-macos.command`** (Двойной клик в Finder) — запускает локальный сервер и открывает `http://localhost:8080`.
2. **`open-offline-macos.command`** (Двойной клик в Finder) — мгновенное открытие страницы в Safari или Google Chrome.
3. Либо через терминал:
   ```bash
   ./start-macos.command
   ```

---

## 🛠️ Использование через консоль (CLI)

Утилита командной строки позволяет в автоматическом режиме конвертировать файлы любого из поддерживаемых языков в блок-схемы (удобно для скриптов и автоматизации генерации отчетов):

```bash
# Генерация векторной блок-схемы SVG для C#:
node cli.js -i tests/fixtures/03_ForLoop.cs -o ForLoop.svg

# Генерация блок-схемы для Python:
node cli.js -i tests/fixtures/11_PythonMaxSum.py -o PythonMaxSum.svg

# Генерация схемы для C++ в формате Microsoft Visio (.vsdx):
node cli.js -i tests/fixtures/12_CppMaxSum.cpp -o CppMaxSum.vsdx

# Генерация схемы для ANSI C:
node cli.js -i tests/fixtures/13_CLinearScanf.c -o CLinearScanf.svg

# Генерация схемы для Go:
node cli.js -i tests/fixtures/14_GoBranching.go -o GoBranching.svg

# Явное указание языка программирования (если нестандартное расширение):
node cli.js -i snippet.txt -l python -o snippet.svg
```

### Параметры CLI:
- `-i, --input <путь>` — входной файл с кодом (обязательный параметр).
- `-o, --output <путь>` — выходной файл (`.svg`, `.vsdx` или `.json`).
- `-l, --lang <язык>` — язык программирования: `csharp`, `python`, `cpp`, `c`, `go` (по умолчанию определяется по расширению файла).
- `-m, --method <имя>` — выбор метода для визуализации (по умолчанию: `Main` или первый метод).
- `-f, --format <тип>` — формат (`svg`, `vsdx`, `json`).
- `-h, --help` — справка по командам.

---

## 📐 Строгое соблюдение ГОСТ 19.701-90 (ЕСПД)

| Элемент | Обозначение по стандарту | Правило реализации в генераторе |
|---|---|---|
| **Пуск / Останов** | Скругленный прямоугольник ($r = h/2$) | Символ «Терминатор» для начала и конца алгоритма с именем метода. |
| **Процесс** | Прямоугольник | Арифметические операции и присваивания. Последовательные операции объединяются в один компактный блок до 4 строк. |
| **Данные (Ввод/Вывод)** | Параллелограмм со скосом граней | `Console.ReadLine()`, `cin`, `scanf`, `input()`, `fmt.Scan`. Текстовые подписи отсекаются, в блоке остаются чистые переменные. |
| **Решение** | Ромб | Условия `if`, `while`. Выходы: «Да» (вниз) и «Нет» (вправо). Ширина ромба масштабируется с запасом $\times 1.48$, чтобы текст гарантированно не выезжал за скосы. |
| **Подготовка** | Вытянутый шестиугольник | Циклы со счетчиком `for` с надписью вида `i от 1 до n`. |
| **Предопределенный процесс** | Прямоугольник с вертикальными полосами | Вызов сторонних методов, функций или процедур. |
| **Линии потока** | Строго ортогональные (90°) | **Стрелки НЕ ставятся** при основном потоке сверху вниз и слева направо (ГОСТ п. 3.2.2). **Стрелки ставятся только** на линиях обратной связи (снизу вверх) и справа налево. |
| **Пересечения** | Отсутствуют | Левый обходной канал выделен под возвраты циклов, правый — под выходы и обходы. Линии не пересекают блоки и друг друга. |

---

## 🧪 Автоматические тесты

Проект снабжен полным набором эталонных алгоритмов на всех поддерживаемых языках:

```bash
node tests/run-tests.js
```

Результат выполнения тестов:
```
======================================================
  Запуск тестов ГОСТ 19.701-90 (C#, Python, C++, C, Go)
======================================================

  ✔ [PASS] 01_LinearIO.cs          Метод: "Main"               | 10 фигур | 9 связей  | VSDX: 58.8 КБ
  ✔ [PASS] 02_IfElse.cs            Метод: "Run"                | 5 фигур  | 4 связи   | VSDX: 51.0 КБ
  ✔ [PASS] 03_ForLoop.cs           Метод: "Run"                | 5 фигур  | 4 связи   | VSDX: 51.0 КБ
  ✔ [PASS] 04_WhileLoop.cs         Метод: "Run"                | 5 фигур  | 4 связи   | VSDX: 51.0 КБ
  ✔ [PASS] 05_DoWhileLoop.cs       Метод: "Run"                | 5 фигур  | 4 связи   | VSDX: 51.0 КБ
  ✔ [PASS] 06_NestedLoops.cs       Метод: "Run"                | 5 фигур  | 4 связи   | VSDX: 51.6 КБ
  ✔ [PASS] 07_MethodCall.cs        Метод: "FactorialIterative" | 6 фигур  | 7 связей  | VSDX: 54.3 КБ
  ✔ [PASS] 08_ArraySum.cs          Метод: "SumWithForeach"     | 6 фигур  | 7 связей  | VSDX: 54.3 КБ
  ✔ [PASS] 09_ComplexBranching.cs  Метод: "Run"                | 6 фигур  | 5 связей  | VSDX: 52.6 КБ
  ✔ [PASS] 10_LabSeries.cs         Метод: "SumSeries"          | 11 фигур | 16 связей | VSDX: 68.5 КБ
  ✔ [PASS] 11_PythonMaxSum.py      Метод: "Основная программа" | 14 фигур | 19 связей | VSDX: 73.2 КБ
  ✔ [PASS] 12_CppMaxSum.cpp        Метод: "main"               | 18 фигур | 23 связи  | VSDX: 79.3 КБ
  ✔ [PASS] 13_CLinearScanf.c       Метод: "main"               | 15 фигур | 18 связей | VSDX: 71.4 КБ
  ✔ [PASS] 14_GoBranching.go       Метод: "main"               | 14 фигур | 17 связей | VSDX: 69.8 КБ

======================================================
  Результаты: 14 успешно, 0 ошибок из 14 тестов.
======================================================
```

---

## 📂 Структура репозитория

```
csharp-gost-flowchart/
├── index.html                     # Главное одностраничное веб-приложение (с поддержкой темной темы)
├── start-windows.bat              # Ярлык запуска для Windows
├── open-offline-windows.bat       # Автономный ярлык для Windows
├── start-macos.command            # Ярлык запуска для macOS
├── open-offline-macos.command     # Автономный ярлык для macOS
├── cli.js                         # Консольная утилита генерации схем (мультиязычная)
├── server.js                      # Встроенный локальный HTTP-сервер (без сторонних npm-пакетов)
├── package.json                   # Метаданные проекта
├── LICENSE                        # Лицензия MIT
├── README.md                      # Документация проекта
├── static/
│   ├── css/
│   │   └── app.css                # Чертёжная тема, стили темной темы, сетка, сплиттер, редактор
│   └── js/
│       ├── csharp-lexer.js        # Лексический анализатор C#
│       ├── csharp-parser.js       # Синтаксический анализатор C# AST
│       ├── lang-parsers.js        # Мультиязычный парсер (C#, Python, C++, C, Go)
│       ├── cfg-builder.js         # Построитель графа управления (CFG)
│       ├── gost-layout.js         # Движок ортогональной ГОСТ-раскладки
│       ├── gost-renderer.js       # Генератор SVG и сборщик архивов Visio VSDX
│       ├── diagram-editor.js      # Визуальный редактор с drag-and-drop
│       ├── csharp-examples.js     # База примеров алгоритмов
│       └── app.js                 # Основной контроллер приложения (управление темами и языками)
└── tests/
    ├── run-tests.js               # Тестовый раннер
    ├── fixtures/                  # 14 файлов эталонных алгоритмов (C#, Python, C++, C, Go)
    └── output/                    # Сгенерированные SVG и VSDX схемы
```

---

## 📄 Лицензия

Проект распространяется под свободной лицензией **MIT**. Вы можете свободно использовать, модифицировать и распространять его в личных, образовательных и коммерческих целях.
