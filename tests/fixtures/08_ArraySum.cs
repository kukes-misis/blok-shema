using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 08 - Array traversal.
    /// foreach over an array plus an indexed for loop accumulation.
    /// Exercises loop-over-collection and accumulating assignment nodes.
    /// </summary>
    public static class ArraySum
    {
        public static int SumWithFor(int[] values)
        {
            int total = 0;

            for (int i = 0; i < values.Length; i++)
            {
                total += values[i];
            }

            return total;
        }

        public static int SumWithForeach(int[] values)
        {
            int total = 0;

            foreach (int value in values)
            {
                total += value;
            }

            return total;
        }

        public static double Average(int[] values)
        {
            if (values.Length == 0)
            {
                return 0.0;
            }

            return (double)SumWithForeach(values) / values.Length;
        }

        public static void Run()
        {
            int[] values = { 4, 8, 15, 16, 23, 42 };

            Console.WriteLine("count   = " + values.Length);
            Console.WriteLine("sum     = " + SumWithFor(values));
            Console.WriteLine("sum(2)  = " + SumWithForeach(values));
            Console.WriteLine("average = " + Average(values));
        }
    }
}
