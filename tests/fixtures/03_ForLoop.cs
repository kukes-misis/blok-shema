using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 03 - Counting for loop.
    /// Canonical init / test / body / increment cycle.
    /// Should render as a loop-back edge from the increment to the test.
    /// </summary>
    public static class ForLoop
    {
        public static int SumTo(int n)
        {
            int total = 0;

            for (int i = 1; i <= n; i++)
            {
                total += i;
            }

            return total;
        }

        public static void Run()
        {
            Console.Write("Enter n: ");
            int n = int.Parse(Console.ReadLine() ?? string.Empty);
            Console.WriteLine("Sum 1.." + n + " = " + SumTo(n));
        }
    }
}
