
using System.Globalization;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var dataDirectory = Path.Combine(
    app.Environment.ContentRootPath, "App_Data");

Directory.CreateDirectory(dataDirectory);

var dbPath = Path.Combine(dataDirectory, "visits.db");
var connectionString = new SqliteConnectionStringBuilder
{
    DataSource = dbPath
}.ToString();

string[] facilities = ["信愛苑", "わかば", "clinicSHIRO"];

await using (var connection = new SqliteConnection(connectionString))
{
    await connection.OpenAsync();

    await using var command = connection.CreateCommand();
    command.CommandText = """
        CREATE TABLE IF NOT EXISTS Reservations (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            VisitDate TEXT NOT NULL,
            VisitTime TEXT NOT NULL,
            ResidentName TEXT NOT NULL,
            BookerName TEXT NOT NULL,
            VisitorCount INTEGER NOT NULL,
            Facility TEXT NOT NULL,
            Detail TEXT NOT NULL DEFAULT '',
            IsDone INTEGER NOT NULL DEFAULT 0,
            CreatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """;

    await command.ExecuteNonQueryAsync();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/reservations", async (string? date) =>
{
    if (!DateOnly.TryParseExact(
            date, "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None, out _))
    {
        return Results.BadRequest(new { message = "日付の指定が正しくありません。" });
    }

    var reservations = new List<ReservationItem>();

    await using var connection = new SqliteConnection(connectionString);
    await connection.OpenAsync();

    await using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT Id, VisitDate, VisitTime, ResidentName,
               BookerName, VisitorCount, Facility, Detail, IsDone
        FROM Reservations
        WHERE VisitDate = $date
        ORDER BY
            CASE Facility
                WHEN '信愛苑' THEN 1
                WHEN 'わかば' THEN 2
                WHEN 'clinicSHIRO' THEN 3
                ELSE 4
            END,
            VisitTime,
            Id;
        """;
    command.Parameters.AddWithValue("$date", date!);

    await using var reader = await command.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
        reservations.Add(new ReservationItem(
            reader.GetInt64(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetInt32(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetInt32(8) == 1));
    }

    return Results.Ok(reservations);
});

app.MapPost("/api/reservations", async (ReservationCreateRequest request) =>
{
    if (!DateOnly.TryParseExact(
            request.Date, "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None, out _))
    {
        return Results.BadRequest(new { message = "登録日が正しくありません。" });
    }

    if (!TimeOnly.TryParseExact(
            request.Time, "HH:mm",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None, out _))
    {
        return Results.BadRequest(new { message = "面会時刻を正しく入力してください。" });
    }

    var residentName = request.ResidentName?.Trim() ?? "";
    var bookerName = request.BookerName?.Trim() ?? "";
    var detail = request.Detail?.Trim() ?? "";

    if (residentName.Length == 0 || residentName.Length > 100)
    {
        return Results.BadRequest(new { message = "入所者名を入力してください（100文字以内）。" });
    }

    if (bookerName.Length == 0 || bookerName.Length > 100)
    {
        return Results.BadRequest(new { message = "予約者名を入力してください（100文字以内）。" });
    }

    if (request.VisitorCount < 1 || request.VisitorCount > 100)
    {
        return Results.BadRequest(new { message = "面会人数は1～100名で入力してください。" });
    }

    if (!facilities.Contains(request.Facility))
    {
        return Results.BadRequest(new { message = "事業所の指定が正しくありません。" });
    }

    if (detail.Length > 500)
    {
        return Results.BadRequest(new { message = "詳細は500文字以内で入力してください。" });
    }

    await using var connection = new SqliteConnection(connectionString);
    await connection.OpenAsync();

    await using var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO Reservations
            (VisitDate, VisitTime, ResidentName, BookerName,
             VisitorCount, Facility, Detail)
        VALUES
            ($date, $time, $resident, $booker,
             $count, $facility, $detail);
        SELECT last_insert_rowid();
        """;

    command.Parameters.AddWithValue("$date", request.Date);
    command.Parameters.AddWithValue("$time", request.Time);
    command.Parameters.AddWithValue("$resident", residentName);
    command.Parameters.AddWithValue("$booker", bookerName);
    command.Parameters.AddWithValue("$count", request.VisitorCount);
    command.Parameters.AddWithValue("$facility", request.Facility);
    command.Parameters.AddWithValue("$detail", detail);

    var id = (long)(await command.ExecuteScalarAsync() ?? 0L);

    return Results.Ok(new { id, message = "予約を登録しました。" });
});

app.MapPut("/api/reservations/{id:long}/status",
    async (long id, ReservationStatusRequest request) =>
{
    await using var connection = new SqliteConnection(connectionString);
    await connection.OpenAsync();

    await using var command = connection.CreateCommand();
    command.CommandText = """
        UPDATE Reservations
        SET IsDone = $isDone
        WHERE Id = $id;
        """;

    command.Parameters.AddWithValue("$isDone", request.IsDone ? 1 : 0);
    command.Parameters.AddWithValue("$id", id);

    var changed = await command.ExecuteNonQueryAsync();

    return changed == 0
        ? Results.NotFound(new { message = "予約が見つかりません。" })
        : Results.Ok(new { message = "実施状況を更新しました。" });
});

app.Run();

record ReservationCreateRequest(
    string Date,
    string Time,
    string ResidentName,
    string BookerName,
    int VisitorCount,
    string Facility,
    string? Detail);

record ReservationStatusRequest(bool IsDone);

record ReservationItem(
    long Id,
    string Date,
    string Time,
    string ResidentName,
    string BookerName,
    int VisitorCount,
    string Facility,
    string Detail,
    bool IsDone);
