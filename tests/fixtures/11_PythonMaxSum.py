# Нахождение максимума и суммы
a = float(input("Enter a: "))
b = float(input("Enter b: "))
c = float(input("Enter c: "))

if a >= b and a >= c:
    max_val = a
elif b >= c:
    max_val = b
else:
    max_val = c

total = 0
for i in range(1, 11):
    total += i

print("Max:", max_val)
print("Sum:", total)
