using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 09 - Complex branching.
    /// switch statement, try/catch/finally, and short-circuit boolean
    /// operators. Exercises multi-way decision nodes and exception edges.
    /// </summary>
    public static class ComplexBranching
    {
        public static string Describe(char op, double a, double b)
        {
            if (b == 0 && (op == '/' || op == '%'))
            {
                return "undefined: division by zero";
            }

            try
            {
                switch (op)
                {
                    case '+':
                        return (a + b).ToString();

                    case '-':
                        return (a - b).ToString();

                    case '*':
                        return (a * b).ToString();

                    case '/':
                        return (a / b).ToString();

                    case '%':
                        return (a % b).ToString();

                    default:
                        throw new ArgumentException("unknown operator: " + op, nameof(op));
                }
            }
            catch (ArgumentException ex)
            {
                return "error: " + ex.Message;
            }
            finally
            {
                Console.WriteLine("evaluated " + a + " " + op + " " + b);
            }
        }

        public static void Run()
        {
            Console.Write("Enter expression (a op b): ");
            string[] parts = (Console.ReadLine() ?? string.Empty).Split(' ');

            double a = double.Parse(parts[0]);
            char op = parts[1][0];
            double b = double.Parse(parts[2]);

            Console.WriteLine("= " + Describe(op, a, b));
        }
    }
}
