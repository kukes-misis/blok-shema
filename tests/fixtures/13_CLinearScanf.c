#include <stdio.h>

int main()
{
    int a, b;
    scanf("%d %d", &a, &b);

    int max;
    if (a > b) {
        max = a;
    } else {
        max = b;
    }

    int sum = 0;
    for (int i = 1; i <= 10; i++) {
        sum += i;
    }

    printf("%d\n", max);
    printf("%d\n", sum);
    return 0;
}
