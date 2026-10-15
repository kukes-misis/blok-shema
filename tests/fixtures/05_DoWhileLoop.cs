using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 05 - Post-tested do/while loop.
    /// The body executes before the condition, so it always runs at least once.
    /// The loop-back edge returns to the body, not to the test.
    /// </summary>
    public static class DoWhileLoop
    {
        public static int CollatzSteps(int start)
        {
            if (start <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(start), "start must be positive");
            }

            int steps = 0;
            int current = start;

            do
            {
                if (current % 2 == 0)
                {
                    current /= 2;
                }
                else
                {
                    current = 3 * current + 1;
                }

                steps++;
            }
            while (current != 1);

            return steps;
        }

        public static void Run()
        {
            Console.Write("Enter a positive integer: ");
            int start = int.Parse(Console.ReadLine() ?? string.Empty);
            Console.WriteLine("Collatz steps: " + CollatzSteps(start));
        }
    }
}
