using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 07 - Method calls and recursion.
    /// Shows call nodes, argument passing, and a recursive self-call edge.
    /// </summary>
    public static class MethodCall
    {
        public static long Factorial(int n)
        {
            if (n < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(n), "n must be non-negative");
            }

            if (n <= 1)
            {
                return 1;
            }

            return n * Factorial(n - 1);
        }

        public static long FactorialIterative(int n)
        {
            long result = 1;

            for (int i = 2; i <= n; i++)
            {
                result = Multiply(result, i);
            }

            return result;
        }

        private static long Multiply(long x, long y)
        {
            return x * y;
        }

        public static void Run()
        {
            Console.Write("Enter n: ");
            int n = int.Parse(Console.ReadLine() ?? string.Empty);

            Console.WriteLine("recursive   = " + Factorial(n));
            Console.WriteLine("iterative   = " + FactorialIterative(n));
        }
    }
}
