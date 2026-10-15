using System;
using System.Collections.Generic;

namespace GostFlowchart.Fixtures
{
    /// <summary>
    /// Fixture 10 - Lab series summation.
    /// Combines branching, a loop, accumulator state, and a helper method.
    /// Computes sum x^k / k! for k = 0..terms, the truncated exponential series.
    /// </summary>
    public static class LabSeries
    {
        public static double SeriesTerm(double x, int k)
        {
            double numerator = 1.0;
            double denominator = 1.0;

            for (int i = 1; i <= k; i++)
            {
                numerator *= x;
                denominator *= i;
            }

            return numerator / denominator;
        }

        public static double SumSeries(double x, int terms)
        {
            if (terms < 0)
            {
                throw new ArgumentOutOfRangeException(nameof(terms), "terms must be non-negative");
            }

            double sum = 0.0;

            for (int k = 0; k <= terms; k++)
            {
                double term = SeriesTerm(x, k);

                if (Math.Abs(term) < 1e-12)
                {
                    break;
                }

                sum += term;
            }

            return sum;
        }

        public static void Run()
        {
            Console.Write("Enter x: ");
            double x = double.Parse(Console.ReadLine() ?? string.Empty);

            Console.Write("Enter number of terms: ");
            int terms = int.Parse(Console.ReadLine() ?? string.Empty);

            double sum = SumSeries(x, terms);

            Console.WriteLine("series sum = " + sum);
            Console.WriteLine("Math.Exp   = " + Math.Exp(x));
            Console.WriteLine("difference = " + Math.Abs(sum - Math.Exp(x)));
        }
    }
}
