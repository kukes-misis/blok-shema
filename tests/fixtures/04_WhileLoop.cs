using System;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 04 - Pre-tested while loop.
    /// The condition is evaluated before the body; the body may run zero times.
    /// Contrast with fixture 05 where the body always runs at least once.
    /// </summary>
    public static class WhileLoop
    {
        public static int CountDigits(int value)
        {
            if (value == 0)
            {
                return 1;
            }

            int n = Math.Abs(value);
            int digits = 0;

            while (n > 0)
            {
                n /= 10;
                digits++;
            }

            return digits;
        }

        public static void Run()
        {
            Console.Write("Enter an integer: ");
            int value = int.Parse(Console.ReadLine() ?? string.Empty);
            Console.WriteLine("Digits: " + CountDigits(value));
        }
    }
}
