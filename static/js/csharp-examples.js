/*!
 * csharp-examples.js — generated C# fixtures for the GOST flowchart renderer.
 *
 * Exposes two globals:
 *   window.FC_EXAMPLES.csharp  — object keyed by example id -> { id, title, blurb,
 *                                filename, language, lines, source }
 *   window.CS_EXAMPLE_LIST     — ordered array of example ids
 *
 * Each "source" is the verbatim contents of a file in tests/fixtures/.
 * Load this file with a plain <script> tag before the code that consumes it.
 *
 * Generated: 2026-10-15
 * Source of truth: tests/fixtures/*.cs — regenerate rather than hand-editing.
 */
(function (global) {
  'use strict';

  var examples = [
  {
    "id": "linear-io",
    "title": "Линейный ввод и вывод (C#)",
    "blurb": "Последовательный поток: чтение Console.ReadLine(), расчет формул и вывод результатов.",
    "filename": "01_LinearIO.cs",
    "language": "csharp",
    "lines": 30,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 01 - Linear I/O.\n    /// Straight-line control flow: read input, compute, write output.\n    /// No branching, no loops. The flow graph should be a single path.\n    /// </summary>\n    public static class LinearIO\n    {\n        public static void Run()\n        {\n            Console.Write(\"Enter a: \");\n            double a = double.Parse(Console.ReadLine() ?? string.Empty);\n\n            Console.Write(\"Enter b: \");\n            double b = double.Parse(Console.ReadLine() ?? string.Empty);\n\n            double sum = a + b;\n            double product = a * b;\n            double mean = sum / 2.0;\n\n            Console.WriteLine(\"a + b = \" + sum);\n            Console.WriteLine(\"a * b = \" + product);\n            Console.WriteLine(\"mean  = \" + mean);\n        }\n    }\n}\n"
  },
  {
    "id": "if-else",
    "title": "Ветвление if / else if / else (C#)",
    "blurb": "Классификация оценок: взаимоисключающие условия с ромбами «Решение» по ГОСТ 19.701-90.",
    "filename": "02_IfElse.cs",
    "language": "csharp",
    "lines": 44,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 02 - If / Else if / Else ladder.\n    /// A single decision node with three mutually exclusive exits\n    /// plus a fallthrough else. Exercises decision-diamond rendering.\n    /// </summary>\n    public static class IfElse\n    {\n        public static string Classify(int score)\n        {\n            if (score < 0 || score > 100)\n            {\n                return \"invalid\";\n            }\n            else if (score >= 90)\n            {\n                return \"excellent\";\n            }\n            else if (score >= 75)\n            {\n                return \"good\";\n            }\n            else if (score >= 60)\n            {\n                return \"pass\";\n            }\n            else\n            {\n                return \"fail\";\n            }\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter score: \");\n            int score = int.Parse(Console.ReadLine() ?? string.Empty);\n            Console.WriteLine(\"Result: \" + Classify(score));\n        }\n    }\n}\n"
  },
  {
    "id": "for-loop",
    "title": "Цикл for со счетчиком (C#)",
    "blurb": "Вычисление суммы чисел от 1 до n: символ «Подготовка» (шестиугольник) и левый обвод возврата.",
    "filename": "03_ForLoop.cs",
    "language": "csharp",
    "lines": 32,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 03 - Counting for loop.\n    /// Canonical init / test / body / increment cycle.\n    /// Should render as a loop-back edge from the increment to the test.\n    /// </summary>\n    public static class ForLoop\n    {\n        public static int SumTo(int n)\n        {\n            int total = 0;\n\n            for (int i = 1; i <= n; i++)\n            {\n                total += i;\n            }\n\n            return total;\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter n: \");\n            int n = int.Parse(Console.ReadLine() ?? string.Empty);\n            Console.WriteLine(\"Sum 1..\" + n + \" = \" + SumTo(n));\n        }\n    }\n}\n"
  },
  {
    "id": "while-loop",
    "title": "Цикл while с предусловием (C#)",
    "blurb": "Подсчет цифр в числе: условие цикла проверяется перед выполнением тела.",
    "filename": "04_WhileLoop.cs",
    "language": "csharp",
    "lines": 39,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 04 - Pre-tested while loop.\n    /// The condition is evaluated before the body; the body may run zero times.\n    /// Contrast with fixture 05 where the body always runs at least once.\n    /// </summary>\n    public static class WhileLoop\n    {\n        public static int CountDigits(int value)\n        {\n            if (value == 0)\n            {\n                return 1;\n            }\n\n            int n = Math.Abs(value);\n            int digits = 0;\n\n            while (n > 0)\n            {\n                n /= 10;\n                digits++;\n            }\n\n            return digits;\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter an integer: \");\n            int value = int.Parse(Console.ReadLine() ?? string.Empty);\n            Console.WriteLine(\"Digits: \" + CountDigits(value));\n        }\n    }\n}\n"
  },
  {
    "id": "do-while-loop",
    "title": "Цикл do-while с постусловием (C#)",
    "blurb": "Гипотеза Коллатца: тело выполняется минимум 1 раз, возврат в тело цикла.",
    "filename": "05_DoWhileLoop.cs",
    "language": "csharp",
    "lines": 48,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 05 - Post-tested do/while loop.\n    /// The body executes before the condition, so it always runs at least once.\n    /// The loop-back edge returns to the body, not to the test.\n    /// </summary>\n    public static class DoWhileLoop\n    {\n        public static int CollatzSteps(int start)\n        {\n            if (start <= 0)\n            {\n                throw new ArgumentOutOfRangeException(nameof(start), \"start must be positive\");\n            }\n\n            int steps = 0;\n            int current = start;\n\n            do\n            {\n                if (current % 2 == 0)\n                {\n                    current /= 2;\n                }\n                else\n                {\n                    current = 3 * current + 1;\n                }\n\n                steps++;\n            }\n            while (current != 1);\n\n            return steps;\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter a positive integer: \");\n            int start = int.Parse(Console.ReadLine() ?? string.Empty);\n            Console.WriteLine(\"Collatz steps: \" + CollatzSteps(start));\n        }\n    }\n}\n"
  },
  {
    "id": "nested-loops",
    "title": "Вложенные циклы (Таблица умножения)",
    "blurb": "Двойной цикл for со счетчиками строк и столбцов и выходом break.",
    "filename": "06_NestedLoops.cs",
    "language": "csharp",
    "lines": 38,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 06 - Nested loops.\n    /// An inner loop inside an outer loop, with a break out of the inner loop.\n    /// Exercises nested loop-back edges and edge crossing in the layout.\n    /// </summary>\n    public static class NestedLoops\n    {\n        public static void PrintMultiplicationTable(int size)\n        {\n            for (int row = 1; row <= size; row++)\n            {\n                for (int col = 1; col <= size; col++)\n                {\n                    if (col > row)\n                    {\n                        break;\n                    }\n\n                    Console.Write((row * col).ToString().PadLeft(4));\n                }\n\n                Console.WriteLine();\n            }\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter table size: \");\n            int size = int.Parse(Console.ReadLine() ?? string.Empty);\n            PrintMultiplicationTable(size);\n        }\n    }\n}\n"
  },
  {
    "id": "method-call",
    "title": "Предопределенный процесс (Вызов метода)",
    "blurb": "Вычисление факториала и символ блока «Предопределенный процесс» с вертикальными полосами.",
    "filename": "07_MethodCall.cs",
    "language": "csharp",
    "lines": 53,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 07 - Method calls and recursion.\n    /// Shows call nodes, argument passing, and a recursive self-call edge.\n    /// </summary>\n    public static class MethodCall\n    {\n        public static long Factorial(int n)\n        {\n            if (n < 0)\n            {\n                throw new ArgumentOutOfRangeException(nameof(n), \"n must be non-negative\");\n            }\n\n            if (n <= 1)\n            {\n                return 1;\n            }\n\n            return n * Factorial(n - 1);\n        }\n\n        public static long FactorialIterative(int n)\n        {\n            long result = 1;\n\n            for (int i = 2; i <= n; i++)\n            {\n                result = Multiply(result, i);\n            }\n\n            return result;\n        }\n\n        private static long Multiply(long x, long y)\n        {\n            return x * y;\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter n: \");\n            int n = int.Parse(Console.ReadLine() ?? string.Empty);\n\n            Console.WriteLine(\"recursive   = \" + Factorial(n));\n            Console.WriteLine(\"iterative   = \" + FactorialIterative(n));\n        }\n    }\n}\n"
  },
  {
    "id": "array-sum",
    "title": "Обработка массива и сумма (C#)",
    "blurb": "Обход элементов массива циклом for / foreach с суммированием и вычислением среднего.",
    "filename": "08_ArraySum.cs",
    "language": "csharp",
    "lines": 57,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 08 - Array traversal.\n    /// foreach over an array plus an indexed for loop accumulation.\n    /// Exercises loop-over-collection and accumulating assignment nodes.\n    /// </summary>\n    public static class ArraySum\n    {\n        public static int SumWithFor(int[] values)\n        {\n            int total = 0;\n\n            for (int i = 0; i < values.Length; i++)\n            {\n                total += values[i];\n            }\n\n            return total;\n        }\n\n        public static int SumWithForeach(int[] values)\n        {\n            int total = 0;\n\n            foreach (int value in values)\n            {\n                total += value;\n            }\n\n            return total;\n        }\n\n        public static double Average(int[] values)\n        {\n            if (values.Length == 0)\n            {\n                return 0.0;\n            }\n\n            return (double)SumWithForeach(values) / values.Length;\n        }\n\n        public static void Run()\n        {\n            int[] values = { 4, 8, 15, 16, 23, 42 };\n\n            Console.WriteLine(\"count   = \" + values.Length);\n            Console.WriteLine(\"sum     = \" + SumWithFor(values));\n            Console.WriteLine(\"sum(2)  = \" + SumWithForeach(values));\n            Console.WriteLine(\"average = \" + Average(values));\n        }\n    }\n}\n"
  },
  {
    "id": "complex-branching",
    "title": "Сложные ветвления и switch (C#)",
    "blurb": "Калькулятор: многоканальный переключатель switch-case и обработка исключений try/catch.",
    "filename": "09_ComplexBranching.cs",
    "language": "csharp",
    "lines": 65,
    "source": "using System;\n\nnamespace GostFlowchart.Fixtures\n{\n    /// <summary>\n    /// Fixture 09 - Complex branching.\n    /// switch statement, try/catch/finally, and short-circuit boolean\n    /// operators. Exercises multi-way decision nodes and exception edges.\n    /// </summary>\n    public static class ComplexBranching\n    {\n        public static string Describe(char op, double a, double b)\n        {\n            if (b == 0 && (op == '/' || op == '%'))\n            {\n                return \"undefined: division by zero\";\n            }\n\n            try\n            {\n                switch (op)\n                {\n                    case '+':\n                        return (a + b).ToString();\n\n                    case '-':\n                        return (a - b).ToString();\n\n                    case '*':\n                        return (a * b).ToString();\n\n                    case '/':\n                        return (a / b).ToString();\n\n                    case '%':\n                        return (a % b).ToString();\n\n                    default:\n                        throw new ArgumentException(\"unknown operator: \" + op, nameof(op));\n                }\n            }\n            catch (ArgumentException ex)\n            {\n                return \"error: \" + ex.Message;\n            }\n            finally\n            {\n                Console.WriteLine(\"evaluated \" + a + \" \" + op + \" \" + b);\n            }\n        }\n\n        public static void Run()\n        {\n            Console.Write(\"Enter expression (a op b): \");\n            string[] parts = (Console.ReadLine() ?? string.Empty).Split(' ');\n\n            double a = double.Parse(parts[0]);\n            char op = parts[1][0];\n            double b = double.Parse(parts[2]);\n\n            Console.WriteLine(\"= \" + Describe(op, a, b));\n        }\n    }\n}\n"
  },
  {
    "id": "lab-series",
    "title": "Лабораторная: Степенной ряд (C#)",
    "blurb": "Студенческая лабораторная работа: вычисление суммы степенного ряда x^k в цикле.",
    "filename": "10_LabSeries.cs",
    "language": "csharp",
    "lines": 67,
    "source": "using System;\nusing System.Collections.Generic;\n\nnamespace GostFlowchart.Fixtures\n{\n    public static class LabSeries\n    {\n        public static void Run()\n        {\n            Console.Write(\"Enter x: \");\n            double x = double.Parse(Console.ReadLine());\n            double sum = 0.0;\n            for (int k = 0; k <= 10; k++)\n            {\n                sum += Math.Pow(x, k);\n            }\n            Console.WriteLine(\"sum = \" + sum);\n        }\n    }\n}\n"
  },
  {
    "id": "python-max-sum",
    "title": "Поиск максимума и сумма (Python)",
    "blurb": "Python 3: ввод input(), логические ветвления if/elif/else и цикл for со счетчиком range(1, 11).",
    "filename": "11_PythonMaxSum.py",
    "language": "python",
    "lines": 18,
    "source": "# Нахождение максимума и суммы\na = float(input(\"Enter a: \"))\nb = float(input(\"Enter b: \"))\nc = float(input(\"Enter c: \"))\n\nif a >= b and a >= c:\n    max_val = a\nelif b >= c:\n    max_val = b\nelse:\n    max_val = c\n\ntotal = 0\nfor i in range(1, 11):\n    total += i\n\nprint(\"Max:\", max_val)\nprint(\"Sum:\", total)\n"
  },
  {
    "id": "cpp-max-sum",
    "title": "Ввод cin, ветвление и вывод cout (C++)",
    "blurb": "C++: чтение cin >> a >> b >> c, ромбы условий по ГОСТ и цикл for со счетчиком.",
    "filename": "12_CppMaxSum.cpp",
    "language": "cpp",
    "lines": 28,
    "source": "#include <iostream>\nusing namespace std;\n\nint main()\n{\n    double a, b, c;\n    cin >> a >> b >> c;\n\n    double max_val;\n    if (a >= b && a >= c) {\n        max_val = a;\n    } else if (b >= c) {\n        max_val = b;\n    } else {\n        max_val = c;\n    }\n\n    int sum = 0;\n    for (int i = 1; i <= 10; i++) {\n        sum += i;\n    }\n\n    cout << \"Max: \" << max_val << endl;\n    cout << \"Sum: \" << sum << endl;\n    return 0;\n}\n"
  },
  {
    "id": "c-linear-scanf",
    "title": "Считывание scanf и расчет (ANSI C)",
    "blurb": "ANSI C: ввод переменных через scanf(), условные переходы и форматированный вывод printf().",
    "filename": "13_CLinearScanf.c",
    "language": "c",
    "lines": 26,
    "source": "#include <stdio.h>\n\nint main()\n{\n    int a, b;\n    scanf(\"%d %d\", &a, &b);\n\n    int max;\n    if (a > b) {\n        max = a;\n    } else {\n        max = b;\n    }\n\n    int sum = 0;\n    for (int i = 1; i <= 10; i++) {\n        sum += i;\n    }\n\n    printf(\"%d\\n\", max);\n    printf(\"%d\\n\", sum);\n    return 0;\n}\n"
  },
  {
    "id": "go-branching",
    "title": "Ветвления и цикл (Go / Golang)",
    "blurb": "Go: ввод через fmt.Scan, условные операторы if без скобок и цикл for со счетчиком.",
    "filename": "14_GoBranching.go",
    "language": "go",
    "lines": 24,
    "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n    var a, b int\n    fmt.Scan(&a, &b)\n\n    var max int\n    if a > b {\n        max = a\n    } else {\n        max = b\n    }\n\n    sum := 0\n    for i := 1; i <= 10; i++ {\n        sum += i\n    }\n\n    fmt.Println(max)\n    fmt.Println(sum)\n}\n"
  }
];

  // Index by id for O(1) lookup.
  var byId = Object.create(null);
  for (var i = 0; i < examples.length; i++) {
    var ex = examples[i];
    byId[ex.id] = ex;
    Object.freeze(ex);
  }

  // Namespaced container. Preserve anything already on FC_EXAMPLES.
  var FC_EXAMPLES = global.FC_EXAMPLES = global.FC_EXAMPLES || {};
  FC_EXAMPLES.csharp = byId;

  // Ordered id list for building menus / prev-next navigation.
  global.CS_EXAMPLE_LIST = [
  "linear-io",
  "if-else",
  "for-loop",
  "while-loop",
  "do-while-loop",
  "nested-loops",
  "method-call",
  "array-sum",
  "complex-branching",
  "lab-series",
  "python-max-sum",
  "cpp-max-sum",
  "c-linear-scanf",
  "go-branching"
];

  // Human-readable titles, index-aligned with CS_EXAMPLE_LIST.
  global.CS_EXAMPLE_TITLES = examples.map(function (e) {
    return e.title;
  });

  // Convenience: resolve an id (or index) to its example object.
  global.CS_EXAMPLE_GET = function (idOrIndex) {
    if (typeof idOrIndex === 'number') {
      return byId[global.CS_EXAMPLE_LIST[idOrIndex]] || null;
    }
    return byId[idOrIndex] || null;
  };

  // Full array of example objects
  global.CS_EXAMPLES = examples;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      examples: examples,
      byId: byId,
      list: global.CS_EXAMPLE_LIST,
      titles: global.CS_EXAMPLE_TITLES,
      get: global.CS_EXAMPLE_GET
    };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
